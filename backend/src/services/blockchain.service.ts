import "dotenv/config";
import { ethers } from "ethers";
import AidRegistryABI from "../abi/AidRegistry.json";
import AidLedgerGovABI from "../abi/AidLedgerGov.json";

// ─────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT VALIDATION
// Fail fast at startup if critical blockchain config is missing.
// ─────────────────────────────────────────────────────────────────────────────
const RPC_URL             = process.env.RPC_URL!;
const AIDLEDGER_GOV_ADDR  = process.env.AIDLEDGER_GOV_ADDRESS!;
const AID_REGISTRY_ADDR   = process.env.AID_REGISTRY_ADDRESS!;
const AIDLEDGER_PRIV_KEY  = process.env.AIDLEDGER_PRIVATE_KEY!;

if (!RPC_URL || !AIDLEDGER_GOV_ADDR || !AID_REGISTRY_ADDR || !AIDLEDGER_PRIV_KEY) {
  throw new Error(
    "FATAL: Missing blockchain environment variables. " +
    "Ensure RPC_URL, AIDLEDGER_GOV_ADDRESS, AID_REGISTRY_ADDRESS, and AIDLEDGER_PRIVATE_KEY are set in .env"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLETON SETUP
// One provider, one wallet, one contract instance for the whole app lifetime.
// ─────────────────────────────────────────────────────────────────────────────

// Connect to the Hyperledger Besu JSON-RPC endpoint
const provider = new ethers.JsonRpcProvider(RPC_URL);

// The AidLedger backend wallet — this is the account that has AIDLEDGER_ROLE
// Security: Private key is loaded from env, never hardcoded in source.
const aidLedgerWallet = new ethers.Wallet(AIDLEDGER_PRIV_KEY, provider);

// Contract instances (read/write via aidLedgerWallet)
const aidRegistry = new ethers.Contract(
  AID_REGISTRY_ADDR,
  AidRegistryABI.abi,
  aidLedgerWallet
);

const aidGov = new ethers.Contract(
  AIDLEDGER_GOV_ADDR,
  AidLedgerGovABI.abi,
  aidLedgerWallet
);

// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY HELPER
// We NEVER store raw CNICs on-chain. Instead we use a keccak256 hash.
// This makes the blockchain record verifiable but not reversible.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a CNIC string to privacy-preserving keccak256 hash.
 * Example:  "4210112345671" → "0xabc123..."
 * The hash is deterministic — same CNIC always produces the same hash.
 */
export function hashCnic(cnic: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(cnic.trim()));
}

/**
 * Returns a masked CNIC safe for log output.
 * Example: "4210112345671" → "CNIC:***9397" 
 * Never log raw CNICs — they are sensitive PII.
 */
function maskCnic(cnic: string): string {
  const clean = cnic.trim();
  return `CNIC:***${clean.slice(-4)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED BLOCKCHAIN FUNCTIONS
// Each function maps to a smart contract callable by AIDLEDGER_ROLE.
// All functions return the transaction hash for audit storage.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step 1 of on-chain pipeline: Log that a new application has been submitted.
 * Maps to: AidRegistry.logApplication(cnicHash)
 */
export async function onChain_logApplication(cnic: string): Promise<string> {
  const cnicHash = hashCnic(cnic);
  const tx = await aidRegistry.logApplication(cnicHash);
  const receipt = await tx.wait();
  console.log(`[Blockchain] logApplication | ${maskCnic(cnic)} | TX: ${receipt.hash}`);
  return receipt.hash;
}

/**
 * Step 2a: Record KYC as PASSED on-chain.
 * Maps to: AidRegistry.markKycPassed(cnicHash)
 */
export async function onChain_markKycPassed(cnic: string): Promise<string> {
  const cnicHash = hashCnic(cnic);
  const tx = await aidRegistry.markKycPassed(cnicHash);
  const receipt = await tx.wait();
  console.log(`[Blockchain] markKycPassed | ${maskCnic(cnic)} | TX: ${receipt.hash}`);
  return receipt.hash;
}

/**
 * Step 2b: Record KYC as FAILED on-chain with reason string.
 * Maps to: AidRegistry.markKycFailed(cnicHash, reason)
 */
export async function onChain_markKycFailed(cnic: string, reason: string): Promise<string> {
  const cnicHash = hashCnic(cnic);
  const tx = await aidRegistry.markKycFailed(cnicHash, reason);
  const receipt = await tx.wait();
  console.log(`[Blockchain] markKycFailed | ${maskCnic(cnic)} | Reason: ${reason} | TX: ${receipt.hash}`);
  return receipt.hash;
}

/**
 * Step 3a: Record eligibility as PASSED with PMT score and zone.
 * Maps to: AidRegistry.markEligible(cnicHash, pmtScore, isUrban)
 * Returns the transaction hash — this becomes the blockchain_approval_hash in eligible table.
 */
export async function onChain_markEligible(
  cnic: string,
  pmtScore: number,
  isUrban: boolean
): Promise<string> {
  const cnicHash = hashCnic(cnic);
  const tx = await aidRegistry.markEligible(cnicHash, pmtScore, isUrban);
  const receipt = await tx.wait();
  console.log(
    `[Blockchain] markEligible | ${maskCnic(cnic)} | Score: ${pmtScore} | Urban: ${isUrban} | TX: ${receipt.hash}`
  );
  return receipt.hash;
}

/**
 * Step 3b: Record eligibility as FAILED on-chain.
 * Maps to: AidRegistry.markIneligible(cnicHash, reason)
 */
export async function onChain_markIneligible(cnic: string, reason: string): Promise<string> {
  const cnicHash = hashCnic(cnic);
  const tx = await aidRegistry.markIneligible(cnicHash, reason);
  const receipt = await tx.wait();
  console.log(`[Blockchain] markIneligible | ${maskCnic(cnic)} | Reason: ${reason} | TX: ${receipt.hash}`);
  return receipt.hash;
}

/**
 * Read the live quarterly disbursement amount from the governance contract.
 * Useful for admin dashboards.
 */
export async function readQuarterlyAmount(): Promise<string> {
  const amount = await aidGov.quarterlyDisbursementAmount();
  return amount.toString();
}

/**
 * Verify the backend wallet has the required AIDLEDGER_ROLE on the AidRegistry.
 * Called at server startup to catch misconfiguration early.
 */
export async function verifyBlockchainConnection(): Promise<void> {
  try {
    const network = await provider.getNetwork();
    const balance = await provider.getBalance(aidLedgerWallet.address);
    console.log(
      `[Blockchain] Connected to Besu network (chainId: ${network.chainId}) | ` +
      `Wallet: ${aidLedgerWallet.address} | Balance: ${ethers.formatEther(balance)} ETH`
    );
  } catch (err) {
    // Non-fatal warning — pipeline can still run but blockchain calls will fail
    console.warn("[Blockchain] WARNING: Could not connect to Besu node. Check RPC_URL in .env.", err);
  }
}
