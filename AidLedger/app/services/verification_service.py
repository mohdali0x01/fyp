"""
Verification Pipeline Service — 3-stage automated eligibility check.

This is the Python port of verification.service.ts.

Pipeline stages:
    Stage 1 → KYC Check     (NADRA lookup in kyc_master table)
    Stage 2 → Family Tree   (check if family already receiving aid)
    Stage 3 → PMT Score     (Proxy Means Test with Urban/Rural weighting)
    Blockchain              (every decision anchored on Hyperledger Besu)
    DB Write                (eligible table populated with blockchain TX hash)

PMT Formula (modeled after BISP/Ehsaas):
    Score range: 0–100 (lower = more poverty = more eligible)
    Urban cutoff: 38.00 → stored on-chain as 3800
    Rural cutoff: 32.00 → stored on-chain as 3200

    [KO]  govt_job == True           → score = 10000 (instant fail)
    [+]   Salary Weight   (max 40)  = (salary / 42000) × 40
    [+]   Utility Weight  (max 20)  = (bills / 12000) × 20
    [+]   Savings Score   (max 20)  = clamp((salary-expense-bills)/10000×20, 0, 20)
    [-]   Dependency Deduct         = family_members × 4
    [-]   Widow Deduction (−8 pts)  = if marital_status == 'widow'

    Result ×100 for on-chain int storage (e.g. 3.30 → 330)
"""
import os
import logging
from typing import Optional

from app.models.db import get_db
from app.services.blockchain_service import (
    on_chain_mark_kyc_passed,
    on_chain_mark_kyc_failed,
    on_chain_mark_eligible,
    on_chain_mark_ineligible,
)

logger = logging.getLogger(__name__)

# ── PMT Constants ─────────────────────────────────────────────────────────────
MAX_SALARY      = 42_000
MAX_BILLS       = 12_000
WIDOW_BONUS     = 8
URBAN_THRESHOLD = 3_800   # 38.00 × 100
RURAL_THRESHOLD = 3_200   # 32.00 × 100

# ── City Zone Map (lazy-loaded on first request) ───────────────────────────────
_city_zone_map: dict[str, str] = {}
_cities_loaded: bool = False


def _ensure_cities_loaded() -> None:
    """Lazy-loads the Cities.txt file into memory on first call."""
    global _cities_loaded
    if _cities_loaded:
        return
    _cities_loaded = True

    cities_file = os.getenv("CITIES_FILE_PATH", "/mnt/e/FYP/Data/Cities.txt")
    try:
        with open(cities_file, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if not stripped:
                    continue
                # Format: "CityName\t\t\tUrban" or "CityName\t\t\tRural"
                parts = stripped.split("\t")
                parts = [p for p in parts if p.strip()]
                if len(parts) >= 2:
                    city = parts[0].strip().lower()
                    zone = parts[-1].strip()
                    _city_zone_map[city] = zone
        logger.info("[Cities] Loaded %d cities from %s", len(_city_zone_map), cities_file)
    except FileNotFoundError:
        logger.error(
            "[Cities] Failed to load cities from %s — defaulting all to Rural", cities_file
        )
    except Exception as err:
        logger.error("[Cities] Unexpected error loading cities: %s", err)


def _resolve_zone(city: Optional[str]) -> str:
    """Returns 'Urban' or 'Rural' for a given city name."""
    _ensure_cities_loaded()
    if not city:
        return "Rural"
    return _city_zone_map.get(city.lower().strip(), "Rural")


# ── PMT Score Engine ──────────────────────────────────────────────────────────

def _calculate_pmt_score(
    salary: Optional[float],
    utility_bill_amount: Optional[float],
    monthly_expense: Optional[float],
    family_members_count: Optional[int],
    govt_job: Optional[bool],
    marital_status: Optional[str],
) -> int:
    """
    Calculates the PMT score. Returns an integer ×100 for on-chain storage.
    Lower score = more poverty = more eligible.
    Returns 10000 instantly for government employees (instant fail).
    """
    sal     = float(salary or 0)
    bills   = float(utility_bill_amount or 0)
    expense = float(monthly_expense or 0)
    members = int(family_members_count or 1)
    is_govt = govt_job is True
    is_widow = (marital_status or "").lower().strip() == "widow"

    if is_govt:
        return 10_000  # Instant fail

    salary_score      = min((sal / MAX_SALARY) * 40, 40.0)
    bill_score        = min((bills / MAX_BILLS) * 20, 20.0)
    leftover          = sal - expense - bills
    savings_score     = min((leftover / 10_000) * 20, 20.0) if leftover > 0 else 0.0
    dependency_deduct = members * 4.0
    widow_deduct      = WIDOW_BONUS if is_widow else 0.0

    raw_score = salary_score + bill_score + savings_score - dependency_deduct - widow_deduct
    clamped   = max(0.0, min(raw_score, 100.0))
    return round(clamped * 100)  # e.g. 3.30 → 330


# ── Pipeline Helpers ──────────────────────────────────────────────────────────

def _update_registration_status(cnic: str, status: str) -> None:
    db = get_db()
    db.registration.update(where={"cnic": cnic}, data={"pipeline_status": status})


def _create_notification(cnic: str, message_urdu: str) -> None:
    db = get_db()
    db.notifications.create(data={
        "cnic":              cnic,
        "message_text_urdu": message_urdu,
        "status":            "SENT",
    })


# ── Main Pipeline ─────────────────────────────────────────────────────────────

def run_verification_pipeline(cnic: str, registration_id: int) -> dict:
    """
    Runs the full 3-stage verification pipeline for a given CNIC.

    Returns:
        dict with keys:
            success (bool)
            message / reason (str)
            pmt_score (int, on success)
            blockchain_hash (str, on success)
            status (str, on failure)
    """
    db = get_db()

    # ── STAGE 1: KYC CHECK ────────────────────────────────────────────────────
    kyc_record = db.kyc_master.find_unique(where={"cnic": cnic})

    if not kyc_record:
        _update_registration_status(cnic, "KYC_FAILED")
        _create_notification(
            cnic,
            "آپ کی درخواست مسترد کردی گئی ہے۔ آپ کا شناختی کارڈ نمبر ہمارے ڈیٹا بیس میں موجود نہیں ہے۔",
        )
        try:
            on_chain_mark_kyc_failed(cnic, "NADRA_NOT_FOUND")
        except Exception as err:
            logger.error("[Blockchain] markKycFailed FAILED: %s", err)
        return {
            "success": False,
            "reason":  "CNIC not found in KYC database.",
            "status":  "KYC_FAILED",
        }

    # KYC passed — anchor on-chain
    try:
        on_chain_mark_kyc_passed(cnic)
    except Exception as err:
        logger.error("[Blockchain] markKycPassed FAILED: %s", err)

    # ── STAGE 2: FAMILY TREE CHECK ────────────────────────────────────────────
    is_head   = db.family_tree.find_first(where={"head_of_family_cnic": cnic})
    is_member = db.family_tree.find_first(
        where={"family_member_cnics": {"has": cnic}}
    )

    if is_head or is_member:
        _update_registration_status(cnic, "FAMILY_INELIGIBLE")
        _create_notification(
            cnic,
            "آپ کی درخواست مسترد کردی گئی ہے۔ آپ کے خاندان کا کوئی فرد پہلے سے امداد حاصل کر رہا ہے۔",
        )
        try:
            on_chain_mark_ineligible(cnic, "FAMILY_ALREADY_ON_AID")
        except Exception as err:
            logger.error("[Blockchain] markIneligible (family) FAILED: %s", err)
        return {
            "success": False,
            "reason":  "A family member is already receiving aid.",
            "status":  "FAMILY_INELIGIBLE",
        }

    # ── STAGE 3: PMT SCORE ENGINE ─────────────────────────────────────────────
    reg_record = db.registration.find_unique(where={"cnic": cnic})
    zone       = _resolve_zone(reg_record.city if reg_record else None)
    is_urban   = zone == "Urban"

    pmt_score = _calculate_pmt_score(
        salary               = float(kyc_record.salary)              if kyc_record.salary              else None,
        utility_bill_amount  = float(kyc_record.utility_bill_amount) if kyc_record.utility_bill_amount else None,
        monthly_expense      = float(kyc_record.monthly_expense)     if kyc_record.monthly_expense     else None,
        family_members_count = kyc_record.family_members_count,
        govt_job             = kyc_record.govt_job,
        marital_status       = kyc_record.marital_status,
    )

    threshold = URBAN_THRESHOLD if is_urban else RURAL_THRESHOLD
    logger.info(
        "[PMT] CNIC:***%s | Zone: %s | Score: %.2f | Threshold: %.2f",
        cnic[-4:], zone, pmt_score / 100, threshold / 100,
    )

    # PMT Failed
    if pmt_score > threshold:
        zone_label = "URBAN" if is_urban else "RURAL"
        reason = f"PMT_FAILED_{zone_label} (Score: {pmt_score / 100:.2f} > Threshold: {threshold / 100:.2f})"
        _update_registration_status(cnic, "PMT_FAILED")
        _create_notification(
            cnic,
            "آپ کی درخواست مسترد کردی گئی ہے۔ آپ کا معاشی اسکور طے شدہ حد سے زیادہ ہے۔",
        )
        try:
            reason_code = "PMT_SCORE_EXCEEDED_URBAN" if is_urban else "PMT_SCORE_EXCEEDED_RURAL"
            on_chain_mark_ineligible(cnic, reason_code)
        except Exception as err:
            logger.error("[Blockchain] markIneligible (PMT) FAILED: %s", err)
        return {"success": False, "reason": reason, "status": "PMT_FAILED"}

    # ── ALL CHECKS PASSED — MARK ELIGIBLE ─────────────────────────────────────

    # 1. Anchor on blockchain (get TX hash)
    blockchain_hash = "BLOCKCHAIN_UNAVAILABLE"
    try:
        blockchain_hash = on_chain_mark_eligible(cnic, pmt_score, is_urban)
    except Exception as err:
        logger.error("[Blockchain] markEligible FAILED: %s", err)
        blockchain_hash = "BLOCKCHAIN_ERROR"

    # 2. Write to eligible table (official eligibility record)
    eligible_record = db.eligible.create(data={
        "cnic":                     cnic,
        "blockchain_approval_hash": blockchain_hash,
        "card_issued":              True,  # Auto-issued immediately
    })

    # 3. AUTO-ISSUE CARD (ZERO HUMAN INTERVENTION)
    import uuid
    from datetime import datetime, timedelta, timezone
    expiry = datetime.now(timezone.utc) + timedelta(days=365 * 3)
    placeholder_uid = f"P-{uuid.uuid4().hex[:10].upper()}"
    
    db.card_issue.create(data={
        "eligible_id":         eligible_record.eligible_id,
        "cnic":                cnic,
        "virtual_card_number": placeholder_uid,
        "card_status":         "PENDING_LINK",
        "expiry_date":         expiry,
    })

    # 4. Update pipeline status
    _update_registration_status(cnic, "ELIGIBLE")

    # 5. Urdu success notification (updated to tell them to link card)
    _create_notification(
        cnic,
        "مبارک ہو! آپ امداد کے اہل قرار پائے ہیں۔ آپ کا سمارٹ کارڈ تیار ہے۔ براہ کرم 'مائی کارڈ' مینو میں جا کر اپنا پلاسٹک کارڈ مشین پر رکھیں تاکہ رقم ایکٹو ہو سکے۔",
    )

    return {
        "success":          True,
        "message":          f"All checks passed. Zone: {zone}. PMT Score: {pmt_score / 100:.2f}. Status: ELIGIBLE.",
        "pmt_score":        pmt_score,
        "blockchain_hash":  blockchain_hash,
    }
