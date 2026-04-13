const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AidLedger GRC Smart Contracts", function () {
  let gov, registry;
  let sbp, aidLedger, bank, auditor, unauthorized;

  // Utility to generate a fake CNIC hash for testing
  const generateCnicHash = (id) => ethers.keccak256(ethers.toUtf8Bytes(id));

  beforeEach(async function () {
    // Get the accounts provided by Hardhat local environment
    [sbp, aidLedger, bank, auditor, unauthorized] = await ethers.getSigners();

    // 1. Deploy Governance
    const GovFactory = await ethers.getContractFactory("AidLedgerGov");
    gov = await GovFactory.connect(sbp).deploy(
      sbp.address,
      aidLedger.address,
      bank.address,
      auditor.address
    );
    await gov.waitForDeployment();

    // 2. Deploy Registry
    const RegistryFactory = await ethers.getContractFactory("AidRegistry");
    registry = await RegistryFactory.connect(sbp).deploy(
      await gov.getAddress(),
      aidLedger.address,
      bank.address,
      auditor.address
    );
    await registry.waitForDeployment();

    // 3. Grant the Registry contract permission to consume the budget
    const aidRole = await gov.AIDLEDGER_ROLE();
    await gov.connect(sbp).grantRole(aidRole, await registry.getAddress());
  });

  describe("1. Deployment & RBAC (Role-Based Access Control)", function () {
    it("Should correctly assign GRC roles to all nodes", async function () {
      const adminRole = await gov.DEFAULT_ADMIN_ROLE();
      const aidRole = await gov.AIDLEDGER_ROLE();
      const bankRole = await gov.BANK_ROLE();
      const auditRole = await gov.AUDITOR_ROLE();

      expect(await gov.hasRole(adminRole, sbp.address)).to.be.true;
      expect(await gov.hasRole(aidRole, aidLedger.address)).to.be.true;
      expect(await gov.hasRole(bankRole, bank.address)).to.be.true;
      expect(await gov.hasRole(auditRole, auditor.address)).to.be.true;
    });

    it("Should prevent unauthorized nodes from changing SBP policies", async function () {
      // AidLedger tries to change the SBP Global Budget
      await expect(
        gov.connect(aidLedger).updateMacroPolicy(500000000000n, 200000)
      ).to.be.revertedWithCustomError(gov, "AccessControlUnauthorizedAccount");
    });
  });

  describe("2. PMT Engine (Urban vs Rural Rules)", function () {
    const userHash1 = generateCnicHash("11111-1111111-1");
    const userHash2 = generateCnicHash("22222-2222222-2");

    beforeEach(async function () {
      // Must pass KYC first
      await registry.connect(aidLedger).logApplication(userHash1);
      await registry.connect(aidLedger).markKycPassed(userHash1);

      await registry.connect(aidLedger).logApplication(userHash2);
      await registry.connect(aidLedger).markKycPassed(userHash2);
    });

    it("Urban resident mapping: Should pass at score 35.00", async function () {
      // Urban Threshold is 38.00 (3800). Score of 3500 is below 3800, so they pass.
      await expect(
        registry.connect(aidLedger).markEligible(userHash1, 3500, true)
      ).to.not.be.reverted;

      const record = await registry.beneficiaries(userHash1);
      expect(record.status).to.equal(5n); // 5 = ELIGIBLE
      expect(record.pmtScore).to.equal(3500n);
    });

    it("Rural resident mapping: Should FAIL at score 35.00", async function () {
      // Rural Threshold is 32.00 (3200). Score of 3500 exceeds 3200, so they fail.
      await expect(
        registry.connect(aidLedger).markEligible(userHash2, 3500, false)
      ).to.be.revertedWith("GRC: PMT Score exceeds Rural poverty threshold (32.00)");
    });
  });

  describe("3. Financial Controls (Cash vs Vendor)", function () {
    const userHash = generateCnicHash("33333-3333333-3");

    beforeEach(async function () {
      // Pipeline: Apply -> KYC -> Eligible (Urban score 25.00) -> Issue Card
      await registry.connect(aidLedger).logApplication(userHash);
      await registry.connect(aidLedger).markKycPassed(userHash);
      await registry.connect(aidLedger).markEligible(userHash, 2500, true);
      await registry.connect(bank).issueCard(userHash);
    });

    it("Should correctly enforce the 10,000 PKR Max Cash limit", async function () {
      // Withdrawing 9,000 is fine
      await registry.connect(bank).recordCashWithdrawal(userHash, 9000);
      let record = await registry.beneficiaries(userHash);
      expect(record.cashWithdrawn).to.equal(9000n);

      // Withdrawing another 2,000 cash should fail (Total 11,000 > 10,000 limit)
      await expect(
        registry.connect(bank).recordCashWithdrawal(userHash, 2000)
      ).to.be.revertedWith("GRC: Exceeds maximum cash withdrawal limit (10,000 PKR)");
    });

    it("Should allow vendor spending beyond the cash limit", async function () {
      // Cash limit is 10k, total balance is 25k. 
      // We can spend 15k at a vendor.
      await registry.connect(bank).recordVendorSpend(userHash, 15000);
      let record = await registry.beneficiaries(userHash);
      expect(record.vendorSpent).to.equal(15000n);
    });

    it("Should prevent double-spending past the quarterly 25k balance", async function () {
      await registry.connect(bank).recordCashWithdrawal(userHash, 10000); // Max cash
      await registry.connect(bank).recordVendorSpend(userHash, 15000); // Rest at vendor

      // Trying to spend 1 more PKR at a vendor should fail
      await expect(
        registry.connect(bank).recordVendorSpend(userHash, 1)
      ).to.be.revertedWith("GRC: Insufficient quarterly balance");
    });
  });

  describe("4. SBP Security & Circuit Breaker", function () {
    const hackerHash = generateCnicHash("HACKER-123");

    it("Should prevent blacklisted users from being processed", async function () {
      // SBP Blacklists the hacker
      await gov.connect(sbp).blacklistCnic(hackerHash);

      // AidLedger attempts to register them, but Smart Contract completely blocks it
      await expect(
        registry.connect(aidLedger).logApplication(hackerHash)
      ).to.be.revertedWith("GRC: CNIC is blacklisted by SBP");
    });

    it("Circuit Breaker completely freezes financial activity", async function () {
      const userHash = generateCnicHash("NORMAL-123");
      await registry.connect(aidLedger).logApplication(userHash);
      await registry.connect(aidLedger).markKycPassed(userHash);
      await registry.connect(aidLedger).markEligible(userHash, 2000, true);
      await registry.connect(bank).issueCard(userHash);

      // SBP detects anomaly, hits the kill switch
      await gov.connect(sbp).pauseSystem();

      // Bank attempts to allow a withdrawal, but system is frozen
      await expect(
        registry.connect(bank).recordCashWithdrawal(userHash, 500)
      ).to.be.revertedWith("GRC: System paused by SBP");

      // AidLedger attempts to change PMT policy, but system is frozen
      await expect(
        gov.connect(aidLedger).updatePmtPolicy(4000, 3500)
      ).to.be.revertedWithCustomError(gov, "EnforcedPause");
    });
  });
});
