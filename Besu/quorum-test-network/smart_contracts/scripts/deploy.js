/**
 * deploy.js
 * 
 * Deploys AidLedgerGov and AidRegistry to the Hyperledger Besu network.
 * 
 * USAGE:
 *   npx hardhat run scripts/deploy.js --network besu
 * 
 * BEFORE RUNNING:
 *   1. Set your 4 node wallet addresses in the ADDRESSES block below.
 *   2. Make sure your Besu RPC is running: http://localhost:8545
 */

const { ethers } = require("hardhat");

// ─── CONFIGURE YOUR NODE ADDRESSES ───────────────────────────────────────────
// These are the wallet addresses for each entity in your 4-node Besu network.
// You can find them inside your docker-compose / node-key files.

const ADDRESSES = {
  sbp:      "0xFE3B557E8Fb62b89F4916B721be55cEb828dBd73", // Replace with SBP node address
  aidLedger:"0x627306090abaB3A6e1400e9345bC60c78a8BEf57", // Replace with AidLedger node address
  bank:     "0xf17f52151EbEF6C7334FAD080c5704D77216b732", // Replace with Bank node address
  auditor:  "0xC5fdf4076b8F3A5357c5E395ab970B5B54098Fef", // Replace with Auditor node address
};
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  AidLedger GRC System — Smart Contract Deployment");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Deployer  : ${deployer.address}`);
  console.log(`  Network   : ${(await ethers.provider.getNetwork()).name}`);
  console.log("───────────────────────────────────────────────────────────");

  // ── Step 1: Deploy AidLedgerGov (Governance / Rulebook) ──────────────────
  console.log("\n[1/2] Deploying AidLedgerGov...");

  const AidLedgerGov = await ethers.getContractFactory("AidLedgerGov");
  const gov = await AidLedgerGov.deploy(
    ADDRESSES.sbp,
    ADDRESSES.aidLedger,
    ADDRESSES.bank,
    ADDRESSES.auditor
  );
  await gov.waitForDeployment();

  const govAddress = await gov.getAddress();
  console.log(`  ✅ AidLedgerGov deployed at : ${govAddress}`);

  // ── Step 2: Deploy AidRegistry (Audit Trail / State Machine) ─────────────
  console.log("\n[2/2] Deploying AidRegistry...");

  const AidRegistry = await ethers.getContractFactory("AidRegistry");
  const registry = await AidRegistry.deploy(
    govAddress,
    ADDRESSES.aidLedger,
    ADDRESSES.bank,
    ADDRESSES.auditor
  );
  await registry.waitForDeployment();

  const registryAddress = await registry.getAddress();
  console.log(`  ✅ AidRegistry deployed at  : ${registryAddress}`);

  // ── Step 3: Grant Permissions ────────────────────────────────────────────
  console.log("\n[3/4] Linking Governance roles...");
  const aidRole = await gov.AIDLEDGER_ROLE();
  const grantTx = await gov.connect(deployer).grantRole(aidRole, registryAddress);
  await grantTx.wait();
  console.log("  ✅ AidRegistry granted AIDLEDGER_ROLE in Governance");

  // ── Step 4: Verify Initial Policy Values ─────────────────────────────────
  console.log("\n[4/4] Verifying initial policy state from AidLedgerGov...");

  const budget     = await gov.globalProgramBudget();
  const capPerUser = await gov.absoluteMaxPerCitizen();
  const quarterly  = await gov.quarterlyDisbursementAmount();
  const cashCap    = await gov.maxCashWithdrawalPerQuarter();
  const vendorCap  = await gov.vendorAllocation();
  const urbanPmt   = await gov.urbanMaxPmtScore();
  const ruralPmt   = await gov.ruralMaxPmtScore();

  console.log("───────────────────────────────────────────────────────────");
  console.log(`  Global Program Budget (SBP)   : ${budget.toString()} PKR`);
  console.log(`  Absolute Max Per Citizen (SBP): ${capPerUser.toString()} PKR`);
  console.log(`  Quarterly Disbursement        : ${quarterly.toString()} PKR`);
  console.log(`  Max Cash Per Cycle            : ${cashCap.toString()} PKR`);
  console.log(`  Vendor Allocation Per Cycle   : ${vendorCap.toString()} PKR`);
  console.log(`  Urban PMT Threshold           : ${(Number(urbanPmt)/100).toFixed(2)}`);
  console.log(`  Rural PMT Threshold           : ${(Number(ruralPmt)/100).toFixed(2)}`);
  console.log("───────────────────────────────────────────────────────────");
  console.log("\n  🎉 Deployment complete! Save the addresses below:");
  console.log(`\n  AidLedgerGov  = "${govAddress}"`);
  console.log(`  AidRegistry   = "${registryAddress}"\n`);
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
