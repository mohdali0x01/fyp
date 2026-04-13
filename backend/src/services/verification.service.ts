import "dotenv/config";
import { prisma } from "../config/prisma";
import * as fs from "fs";
import * as path from "path";
import {
  onChain_markKycPassed,
  onChain_markKycFailed,
  onChain_markEligible,
  onChain_markIneligible,
} from "./blockchain.service";

export type VerificationResult =
  | { success: true; message: string; pmtScore?: number; blockchainHash?: string }
  | { success: false; reason: string; status: string };

// ─────────────────────────────────────────────────────────────────────────────
// CITY LOOKUP  (loads cities.txt once at startup)
// ─────────────────────────────────────────────────────────────────────────────

// Path loaded from .env so it works in both WSL and Docker environments
const getCitiesFilePath = () =>
  process.env.CITIES_FILE_PATH || path.resolve(process.cwd(), "../Data/Cities.txt");

const cityZoneMap: Map<string, "Urban" | "Rural"> = new Map();
let citiesLoaded = false;

function ensureCitiesLoaded(): void {
  if (citiesLoaded) return;
  citiesLoaded = true;
  const CITIES_FILE = getCitiesFilePath();
  try {
    const lines = fs.readFileSync(CITIES_FILE, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Format: "CityName\t\t\tUrban" or "CityName\t\t\tRural"
      const parts = trimmed.split(/\t+/);
      if (parts.length >= 2) {
        const city = parts[0].trim().toLowerCase();
        const zone = parts[parts.length - 1].trim() as "Urban" | "Rural";
        cityZoneMap.set(city, zone);
      }
    }
    console.log(`[Cities] Loaded ${cityZoneMap.size} cities from ${CITIES_FILE}`);
  } catch (err) {
    console.error(`[Cities] Failed to load cities from ${CITIES_FILE} — defaulting all to Rural:`, err);
  }
}

function resolveZone(city: string | null | undefined): "Urban" | "Rural" {
  ensureCitiesLoaded();
  if (!city) return "Rural";
  return cityZoneMap.get(city.toLowerCase().trim()) ?? "Rural";
}

// ─────────────────────────────────────────────────────────────────────────────
// PMT SCORE ENGINE  (Proxy Means Test — modeled after BISP/Ehsaas)
//
// Score range : 0–100  (lower = more poverty)
// Urban cutoff: 38.00  → stored on blockchain as 3800
// Rural cutoff: 32.00  → stored on blockchain as 3200
//
// FORMULA (V2 with geographic + widow weight):
//   [KO]  govt_job == true                → score = 10000 (instant fail)
//   [+]   Salary Weight     (max 40 pts) = (salary / 42000) × 40
//   [+]   Utility Weight    (max 20 pts) = (bills / 12000) × 20
//   [+]   Savings Capacity  (max 20 pts) = clamp((salary-expense-bills)/10000×20, 0, 20)
//   [-]   Dependency Deduct             = familyMembers × 4
//   [-]   Widow Deduction (−8 pts)      = applied if marital_status == 'widow'
//
// Result ×100 for on-chain integer storage (e.g. 3.30 → 330)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SALARY  = 42_000;
const MAX_BILLS   = 12_000;
const WIDOW_BONUS = 8;

interface KycData {
  salary:               number | null;
  utility_bill_amount:  number | null;
  monthly_expense:      number | null;
  family_members_count: number | null;
  govt_job:             boolean | null;
  marital_status:       string | null;
}

function calculatePmtScore(kyc: KycData): number {
  const salary  = Number(kyc.salary)               || 0;
  const bills   = Number(kyc.utility_bill_amount)  || 0;
  const expense = Number(kyc.monthly_expense)      || 0;
  const members = Number(kyc.family_members_count) || 1;
  const isGovt  = kyc.govt_job === true;
  const isWidow = (kyc.marital_status ?? "").toLowerCase().trim() === "widow";

  if (isGovt) return 10_000; // instant fail — government employees are ineligible

  const salaryScore      = Math.min((salary / MAX_SALARY) * 40, 40);
  const billScore        = Math.min((bills  / MAX_BILLS)  * 20, 20);
  const leftover         = salary - expense - bills;
  const savingsScore     = leftover > 0 ? Math.min((leftover / 10_000) * 20, 20) : 0;
  const dependencyDeduct = members * 4;
  const widowDeduct      = isWidow ? WIDOW_BONUS : 0;

  const rawScore = salaryScore + billScore + savingsScore - dependencyDeduct - widowDeduct;
  const clamped  = Math.max(0, Math.min(rawScore, 100));
  return Math.round(clamped * 100); // e.g. 3.30 → 330
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION PIPELINE — FULLY AUTOMATED, ZERO HUMAN INTERVENTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * STAGE 1 → KYC CHECK     (NADRA lookup in kyc_master)
 * STAGE 2 → FAMILY TREE   (is family already on aid?)
 * STAGE 3 → PMT SCORE     (poverty means test with geographic weighting)
 * BLOCKCHAIN              (all decisions anchored on Hyperledger Besu)
 * DB WRITE                (eligible table populated on success with tx hash)
 */
export const runVerificationPipeline = async (
  cnic: string,
  registrationId: number
): Promise<VerificationResult> => {

  // ── STAGE 1: KYC CHECK ──────────────────────────────────────────────────────
  const kycRecord = await prisma.kyc_master.findUnique({ where: { cnic } });

  if (!kycRecord) {
    await updateRegistrationStatus(cnic, "KYC_FAILED");
    await createNotification(
      cnic,
      "آپ کی درخواست مسترد کردی گئی ہے۔ آپ کا شناختی کارڈ نمبر ہمارے ڈیٹا بیس میں موجود نہیں ہے۔"
    );
    // Log KYC failure on-chain (best-effort — don't crash pipeline if Besu is down)
    try {
      await onChain_markKycFailed(cnic, "NADRA_NOT_FOUND");
    } catch (bcErr: any) {
      console.error("[Blockchain] markKycFailed FAILED:", bcErr?.reason || bcErr?.message || bcErr);
    }
    return { success: false, reason: "CNIC not found in KYC database.", status: "KYC_FAILED" };
  }

  // KYC passed — record on-chain
  try {
    await onChain_markKycPassed(cnic);
  } catch (bcErr: any) {
    console.error("[Blockchain] markKycPassed FAILED:", bcErr?.reason || bcErr?.message || bcErr);
  }

  // ── STAGE 2: FAMILY TREE CHECK ──────────────────────────────────────────────
  const isHead = await prisma.family_tree.findFirst({
    where: { head_of_family_cnic: cnic },
  });

  const isMember = await prisma.family_tree.findFirst({
    where: { family_member_cnics: { has: cnic } },
  });

  if (isHead || isMember) {
    await updateRegistrationStatus(cnic, "FAMILY_INELIGIBLE");
    await createNotification(
      cnic,
      "آپ کی درخواست مسترد کردی گئی ہے۔ آپ کے خاندان کا کوئی فرد پہلے سے امداد حاصل کر رہا ہے۔"
    );
    // Family ineligibility is an eligibility rejection (KYC already passed above)
    try {
      await onChain_markIneligible(cnic, "FAMILY_ALREADY_ON_AID");
    } catch (bcErr: any) {
      console.error("[Blockchain] markIneligible (family) FAILED:", bcErr?.reason || bcErr?.message || bcErr);
    }
    return {
      success: false,
      reason: "A family member is already receiving aid.",
      status: "FAMILY_INELIGIBLE",
    };
  }

  // ── STAGE 3: PMT SCORE ENGINE ───────────────────────────────────────────────

  // Fetch applicant's city from registration to determine Urban/Rural zone
  const regRecord = await prisma.registration.findUnique({
    where: { cnic },
    select: { city: true },
  });

  const zone    = resolveZone(regRecord?.city);
  const isUrban = zone === "Urban";

  const pmtScoreOnChain = calculatePmtScore({
    salary:               kycRecord.salary               ? Number(kycRecord.salary)              : null,
    utility_bill_amount:  kycRecord.utility_bill_amount  ? Number(kycRecord.utility_bill_amount) : null,
    monthly_expense:      kycRecord.monthly_expense      ? Number(kycRecord.monthly_expense)     : null,
    family_members_count: kycRecord.family_members_count,
    govt_job:             kycRecord.govt_job,
    marital_status:       kycRecord.marital_status,
  });

  const URBAN_THRESHOLD = 3_800; // 38.00
  const RURAL_THRESHOLD = 3_200; // 32.00
  const threshold       = isUrban ? URBAN_THRESHOLD : RURAL_THRESHOLD;

  console.log(
    `[PMT] CNIC:***${cnic.slice(-4)} | Zone: ${zone} | Score: ${pmtScoreOnChain / 100} | Threshold: ${threshold / 100}`
  );

  // ── PMT FAILED ──────────────────────────────────────────────────────────────
  if (pmtScoreOnChain > threshold) {
    const reason = isUrban
      ? `PMT_FAILED_URBAN (Score: ${pmtScoreOnChain / 100} > Threshold: 38.00)`
      : `PMT_FAILED_RURAL (Score: ${pmtScoreOnChain / 100} > Threshold: 32.00)`;

    await updateRegistrationStatus(cnic, "PMT_FAILED");
    await createNotification(
      cnic,
      "آپ کی درخواست مسترد کردی گئی ہے۔ آپ کا معاشی اسکور طے شدہ حد سے زیادہ ہے۔"
    );
    try {
      await onChain_markIneligible(cnic, isUrban ? "PMT_SCORE_EXCEEDED_URBAN" : "PMT_SCORE_EXCEEDED_RURAL");
    } catch (bcErr: any) {
      console.error("[Blockchain] markIneligible (PMT) FAILED:", bcErr?.reason || bcErr?.message || bcErr);
    }
    return { success: false, reason, status: "PMT_FAILED" };
  }

  // ── ALL CHECKS PASSED — MARK ELIGIBLE ───────────────────────────────────────

  // 1. Call blockchain to anchor the eligibility decision (gets the tx hash)
  let blockchainHash = "BLOCKCHAIN_UNAVAILABLE";
  try {
    blockchainHash = await onChain_markEligible(cnic, pmtScoreOnChain, isUrban);
  } catch (bcErr: any) {
    console.error("[Blockchain] markEligible FAILED:", bcErr?.reason || bcErr?.message || bcErr);
    blockchainHash = "BLOCKCHAIN_ERROR";
  }

  // 2. Write to the `eligible` table — this is the official eligibility record in PostgreSQL
  await prisma.eligible.create({
    data: {
      cnic,
      blockchain_approval_hash: blockchainHash,
      card_issued: false,
    },
  });

  // 3. Update registration pipeline status to ELIGIBLE
  await updateRegistrationStatus(cnic, "ELIGIBLE");

  // 4. Send success notification in Urdu
  await createNotification(
    cnic,
    "مبارک ہو! آپ کی درخواست کامیابی سے تصدیق ہو گئی ہے۔ آپ امداد کے اہل قرار پائے ہیں۔ بینک آپ کا کارڈ جاری کرے گا۔"
  );

  return {
    success: true,
    message: `All checks passed. Zone: ${zone}. PMT Score: ${pmtScoreOnChain / 100}. Status: ELIGIBLE.`,
    pmtScore: pmtScoreOnChain,
    blockchainHash,
  };
};

// ─── Internal Helpers ─────────────────────────────────────────────────────────

const updateRegistrationStatus = async (cnic: string, status: string): Promise<void> => {
  await prisma.registration.update({
    where: { cnic },
    data: { pipeline_status: status },
  });
};

const createNotification = async (cnic: string, message: string): Promise<void> => {
  await prisma.notifications.create({
    data: {
      cnic,
      message_text_urdu: message,
      status: "PENDING",
    },
  });
};
