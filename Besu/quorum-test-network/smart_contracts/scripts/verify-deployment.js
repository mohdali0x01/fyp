const { ethers } = require("hardhat");

async function main() {
  const govAddress = "0x42699A7612A82f1d9C36148af9C77354759b210b";
  const registryAddress = "0xa50a51c09a5c451C52BB714527E1974b686D8e77";

  console.log("🔍 Checking Blockchain for AidLedger Contracts...");
  console.log("───────────────────────────────────────────────────");

  // Check if contract code exists at the address
  const govCode = await ethers.provider.getCode(govAddress);
  const registryCode = await ethers.provider.getCode(registryAddress);

  if (govCode === "0x" || registryCode === "0x") {
    console.log("❌ ERROR: No code found at these addresses. Deployment might have failed or you are on the wrong network.");
  } else {
    console.log("✅ SUCCESS: Contract code found at both addresses.");
    
    const gov = await ethers.getContractAt("AidLedgerGov", govAddress);
    const budget = await gov.globalProgramBudget();
    const urban = await gov.urbanMaxPmtScore();
    
    console.log(`📊 Live Data from Chain:`);
    console.log(`   Global Budget: ${budget.toString()} PKR`);
    console.log(`   Urban PMT Limit: ${(Number(urban)/100).toFixed(2)}`);
  }
  console.log("───────────────────────────────────────────────────");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
