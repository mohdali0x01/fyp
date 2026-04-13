const { ethers } = require("hardhat");

async function main() {
  const govAddress = "0x42699A7612A82f1d9C36148af9C77354759b210b";
  
  // AidLedger Node Key → address 0x627306090abaB3A6e1400e9345bC60c78a8BEf57
  // This account was granted AIDLEDGER_ROLE during deployment.
  const privateKey = "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3";
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const aidLedgerWallet = new ethers.Wallet(privateKey, provider);

  const gov = await ethers.getContractAt("AidLedgerGov", govAddress, aidLedgerWallet);

  console.log(`⚡ Sending transaction from AidLedger: ${aidLedgerWallet.address}`);
  console.log("⚡ UPDATING PMT POLICY (Jury Demo Mode)...");
  
  // Change Rural threshold to 32.10
  const tx = await gov.updatePmtPolicy(3800, 3210);
  console.log(`⏳ Waiting for block confirmation... (Tx: ${tx.hash})`);
  await tx.wait();

  console.log("------------------------------------------------------------------");
  console.log("✅ LIVE TRANSACTION RECORDED!");
  console.log(`   Hash: ${tx.hash}`);
  console.log("\n   1. Open Blockscout: http://localhost:26000");
  console.log("   2. You will see a new transaction in the 'Latest Transactions' list.");
  console.log("   3. This PROVES the system is responding in real-time.");
  console.log("------------------------------------------------------------------");
}

main().catch(console.error);
