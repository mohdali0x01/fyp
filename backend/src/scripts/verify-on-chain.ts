import "dotenv/config";
import { ethers } from "ethers";
import { hashCnic } from "../services/blockchain.service";
import AidRegistryABI from "../abi/AidRegistry.json";

async function verifyOnChain() {
  const cnic = process.argv[2];

  if (!cnic) {
    console.error("❌ Error: Please provide a CNIC (e.g., npx tsx verify-on-chain.ts 3310004209201)");
    process.exit(1);
  }

  const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
  const REGISTRY_ADDR = process.env.AID_REGISTRY_ADDRESS;

  if (!REGISTRY_ADDR) {
    console.error("❌ Error: AID_REGISTRY_ADDRESS not found in .env");
    process.exit(1);
  }

  console.log(`\n🔍 Querying Blockchain for CNIC: ${cnic}...`);
  
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const registry = new ethers.Contract(REGISTRY_ADDR, AidRegistryABI.abi, provider);

  const cnicHash = hashCnic(cnic);
  const record = await registry.beneficiaries(cnicHash);

  const STATUS_MAP = [
    "NONE", "APPLIED", "KYC_FAILED", "KYC_PASSED", "INELIGIBLE", "ELIGIBLE", "CARD_ISSUED", "ACTIVE"
  ];

  const statusNum = Number(record.status);

  console.log("───────────────────────────────────────────────────");
  console.log(`✅ On-Chain Identity Link: ${cnicHash}`);
  console.log(`📊 Status on Besu:         ${STATUS_MAP[statusNum]} (${statusNum})`);
  console.log(`💰 PMT Score (Blockchain): ${(Number(record.pmtScore) / 100).toFixed(2)}`);
  console.log(`🏙️  Zone:                  ${record.isUrban ? "Urban" : "Rural"}`);
  console.log(`📅 Registration Time:     ${record.cycleStartTimestamp > 0 ? new Date(Number(record.cycleStartTimestamp) * 1000).toLocaleString() : "N/A"}`);
  console.log("───────────────────────────────────────────────────");
  
  if (statusNum === 5) {
     console.log("🌟 PROOF: This user passed all GRC rules (KYC + Family + PMT) and was accepted by the Smart Contract.");
  } else if (statusNum === 0) {
     console.log("⚠️  RESULT: This CNIC has no registration record on the blockchain.");
  }
}

verifyOnChain().catch(console.error);
