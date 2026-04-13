// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AidLedgerGov.sol";

/**
 * @title AidRegistry
 * @author AidLedger
 * @notice GRC Audit-Trail & State-Machine Contract.
 *
 *  Tracks every beneficiary from first application through to funds withdrawal.
 *  All state changes are enforced against the live rules inside AidLedgerGov.
 *
 *  WHO CAN DO WHAT
 *  ────────────────────────────────────────────────────────
 *  AidLedger  →  logStatus()  /  markKycPassed()  /  markEligible()
 *  Bank       →  issueCard()  /  recordCashWithdrawal()  /  recordVendorSpend()
 *                /  reclaimExpiredFunds()
 *  Auditor    →  flagAnomaly()  (read-only for everything else)
 *  SBP        →  inherited circuit-breaker via AidLedgerGov.pauseSystem()
 */
contract AidRegistry is AccessControl, ReentrancyGuard {

    // ─────────────────────────────────────────────────────────────────────────
    // REFERENCE TO GOVERNANCE CONTRACT
    // ─────────────────────────────────────────────────────────────────────────

    AidLedgerGov public immutable gov;


    // ─────────────────────────────────────────────────────────────────────────
    // BENEFICIARY STATE MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    enum Status {
        NONE,           // 0 — never registered
        APPLIED,        // 1 — registered; pipeline running
        KYC_FAILED,     // 2 — NADRA lookup failed
        KYC_PASSED,     // 3 — NADRA lookup passed
        INELIGIBLE,     // 4 — failed eligibility check (salary / family)
        ELIGIBLE,       // 5 — all checks passed; Bank may issue card
        CARD_ISSUED,    // 6 — virtual/NFC card issued by Bank
        ACTIVE          // 7 — card active; funds being spent
    }

    struct BeneficiaryRecord {
        Status  status;
        bool    kycPassed;
        uint256 pmtScore;              // PMT score ×100 (e.g., 330 = 3.30)
        bool    isUrban;               // Geographic zone flag
        uint256 cycleStartTimestamp;   // when the current quarterly cycle began
        uint256 quarterlyBalance;      // PKR available this quarter
        uint256 cashWithdrawn;         // cash pulled out this cycle
        uint256 vendorSpent;           // vendor transactions this cycle
        uint256 totalReceivedLifetime; // cumulative across all cycles
        bool    fundsExpired;          // true if cycle closed without full spend
    }

    /// @notice cnicHash → BeneficiaryRecord
    mapping(bytes32 => BeneficiaryRecord) public beneficiaries;

    /// @notice Audit log: every status change ever made for a hash
    struct AuditEntry {
        Status  newStatus;
        string  reasonCode;
        address actor;
        uint256 timestamp;
    }
    mapping(bytes32 => AuditEntry[]) private _auditLog;


    // ─────────────────────────────────────────────────────────────────────────
    // ANOMALY / VIOLATION LOG  (Auditor  → SBP)
    // ─────────────────────────────────────────────────────────────────────────

    struct AnomalyReport {
        bytes32 cnicHash;
        string  reasonCode;
        address flaggedBy;
        uint256 timestamp;
    }
    AnomalyReport[] public anomalyReports;


    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS  (every important state change becomes an immutable event)
    // ─────────────────────────────────────────────────────────────────────────

    event BeneficiaryApplied    (bytes32 indexed cnicHash, uint256 timestamp);
    event KycResult             (bytes32 indexed cnicHash, bool passed, string reason, address actor);
    event EligibilityResult     (bytes32 indexed cnicHash, bool eligible, uint256 pmtScore, bool isUrban, string reason, address actor);
    event CardIssued            (bytes32 indexed cnicHash, uint256 quarterlyBalance, address issuedBy);
    event CashWithdrawal        (bytes32 indexed cnicHash, uint256 amount, uint256 remaining, address bank);
    event VendorPurchase        (bytes32 indexed cnicHash, uint256 amount, uint256 remaining, address vendor);
    event FundsExpiredReclaimed (bytes32 indexed cnicHash, uint256 reclaimedAmount, uint256 timestamp);
    event AnomalyFlagged        (bytes32 indexed cnicHash, string  reasonCode, address auditor, uint256 timestamp);


    // ─────────────────────────────────────────────────────────────────────────
    // MODIFIERS
    // ─────────────────────────────────────────────────────────────────────────

    modifier notBlacklisted(bytes32 cnicHash) {
        require(!gov.isBlacklisted(cnicHash), "GRC: CNIC is blacklisted by SBP");
        _;
    }

    modifier systemNotPaused() {
        require(!gov.paused(), "GRC: System paused by SBP");
        _;
    }


    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param govAddress      Deployed address of AidLedgerGov.
     * @param aidLedgerAddr   AidLedger backend wallet (must already have AIDLEDGER_ROLE in gov).
     * @param bankAddress     Bank node wallet.
     * @param auditorAddress  Auditor node wallet.
     */
    constructor(
        address govAddress,
        address aidLedgerAddr,
        address bankAddress,
        address auditorAddress
    ) {
        require(govAddress     != address(0), "Gov address required");
        require(aidLedgerAddr  != address(0), "AidLedger address required");
        require(bankAddress    != address(0), "Bank address required");
        require(auditorAddress != address(0), "Auditor address required");

        gov = AidLedgerGov(govAddress);

        // Mirror roles from Gov so this contract knows who is who
        _grantRole(gov.AIDLEDGER_ROLE(), aidLedgerAddr);
        _grantRole(gov.BANK_ROLE(),      bankAddress);
        _grantRole(gov.AUDITOR_ROLE(),   auditorAddress);
    }


    // ─────────────────────────────────────────────────────────────────────────
    // AIDLEDGER FUNCTIONS  (AIDLEDGER_ROLE)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Step 1 — Backend logs a new application after the user registers.
     *         Enforces Rule 2.3: immutable pipeline start event.
     */
    function logApplication(bytes32 cnicHash)
        external
        onlyRole(gov.AIDLEDGER_ROLE())
        systemNotPaused
        notBlacklisted(cnicHash)
    {
        require(
            beneficiaries[cnicHash].status == Status.NONE,
            "Applicant already registered"
        );

        beneficiaries[cnicHash].status = Status.APPLIED;

        _writeAudit(cnicHash, Status.APPLIED, "APPLICATION_SUBMITTED", msg.sender);
        emit BeneficiaryApplied(cnicHash, block.timestamp);
    }

    /**
     * @notice Step 2a — KYC check passed.
     *         Rule 1.6: kycMandatory gate enforced here.
     */
    function markKycPassed(bytes32 cnicHash)
        external
        onlyRole(gov.AIDLEDGER_ROLE())
        systemNotPaused
        notBlacklisted(cnicHash)
    {
        require(
            beneficiaries[cnicHash].status == Status.APPLIED,
            "Must be in APPLIED state"
        );

        beneficiaries[cnicHash].kycPassed = true;
        beneficiaries[cnicHash].status    = Status.KYC_PASSED;

        _writeAudit(cnicHash, Status.KYC_PASSED, "KYC_PASSED_NADRA", msg.sender);
        emit KycResult(cnicHash, true, "KYC_PASSED_NADRA", msg.sender);
    }

    /**
     * @notice Step 2b — KYC check failed (reason stored on-chain for SBP & Auditor).
     * @param reason  e.g. "NADRA_NOT_FOUND" / "CNIC_EXPIRED" / "DUPLICATE_ENTRY"
     */
    function markKycFailed(bytes32 cnicHash, string calldata reason)
        external
        onlyRole(gov.AIDLEDGER_ROLE())
        systemNotPaused
    {
        require(
            beneficiaries[cnicHash].status == Status.APPLIED,
            "Must be in APPLIED state"
        );

        beneficiaries[cnicHash].status = Status.KYC_FAILED;

        _writeAudit(cnicHash, Status.KYC_FAILED, reason, msg.sender);
        emit KycResult(cnicHash, false, reason, msg.sender);
    }

    /**
     * @notice Step 3a — Eligibility check passed (PMT Score verified).
     *         Rule 1.6 enforced: KYC must have passed first.
     *         Rule 2.1 enforced: pmtScore must be below the zone-specific SBP threshold.
     *         Rule 2.4: Only AidLedger can mark eligible.
     * @param pmtScore   The calculated PMT score ×100 (e.g., 330 = score of 3.30).
     * @param isUrban    True if the applicant lives in an Urban city, False for Rural.
     */
    function markEligible(bytes32 cnicHash, uint256 pmtScore, bool isUrban)
        external
        onlyRole(gov.AIDLEDGER_ROLE())
        systemNotPaused
        notBlacklisted(cnicHash)
    {
        BeneficiaryRecord storage r = beneficiaries[cnicHash];

        require(r.status == Status.KYC_PASSED, "KYC must pass before eligibility");

        if (gov.kycMandatory()) {
            require(r.kycPassed, "GRC: KYC not confirmed");
        }

        // ── Rule 2.1: Enforce the correct geographic PMT threshold ──────────────────
        uint256 threshold = isUrban ? gov.urbanMaxPmtScore() : gov.ruralMaxPmtScore();
        require(
            pmtScore <= threshold,
            isUrban
                ? "GRC: PMT Score exceeds Urban poverty threshold (38.00)"
                : "GRC: PMT Score exceeds Rural poverty threshold (32.00)"
        );

        r.status   = Status.ELIGIBLE;
        r.pmtScore = pmtScore;
        r.isUrban  = isUrban;

        _writeAudit(cnicHash, Status.ELIGIBLE, "ELIGIBILITY_PASSED", msg.sender);
        emit EligibilityResult(cnicHash, true, pmtScore, isUrban, "ELIGIBILITY_PASSED", msg.sender);
    }

    /**
     * @notice Step 3b — Eligibility check failed.
     * @param reason  e.g. "SALARY_EXCEEDED" / "FAMILY_SIZE_EXCEEDED" / "PMT_SCORE_TOO_HIGH"
     */
    function markIneligible(bytes32 cnicHash, string calldata reason)
        external
        onlyRole(gov.AIDLEDGER_ROLE())
        systemNotPaused
    {
        require(
            beneficiaries[cnicHash].status == Status.KYC_PASSED,
            "Must be in KYC_PASSED state"
        );

        beneficiaries[cnicHash].status = Status.INELIGIBLE;

        _writeAudit(cnicHash, Status.INELIGIBLE, reason, msg.sender);
        emit EligibilityResult(cnicHash, false, 0, false, reason, msg.sender);
    }


    // ─────────────────────────────────────────────────────────────────────────
    // BANK FUNCTIONS  (BANK_ROLE)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Rule 3.4 — Bank issues the virtual/NFC card.
     *         Deducts from the global SBP budget (via Gov.consumeBudget).
     *         Sets the quarterly allowance: 25,000 PKR (10k cash + 15k vendor).
     */
    function issueCard(bytes32 cnicHash)
        external
        onlyRole(gov.BANK_ROLE())
        systemNotPaused
        notBlacklisted(cnicHash)
    {
        BeneficiaryRecord storage r = beneficiaries[cnicHash];

        require(r.status == Status.ELIGIBLE, "GRC: Must be ELIGIBLE before card issuance");

        uint256 amount = gov.quarterlyDisbursementAmount(); // 25,000 PKR

        // Deducts from global budget and checks lifetime cap (Gov enforces this)
        gov.consumeBudget(cnicHash, amount);

        r.status               = Status.CARD_ISSUED;
        r.quarterlyBalance     = amount;
        r.cashWithdrawn        = 0;
        r.vendorSpent          = 0;
        r.cycleStartTimestamp  = block.timestamp;
        r.fundsExpired         = false;

        _writeAudit(cnicHash, Status.CARD_ISSUED, "CARD_ISSUED_BY_BANK", msg.sender);
        emit CardIssued(cnicHash, amount, msg.sender);
    }

    /**
     * @notice Rule 3.2 — Beneficiary withdraws cash at ATM.
     *         Hard cap: 10,000 PKR per cycle.
     *         Card moves to ACTIVE state on first spend/withdraw.
     */
    function recordCashWithdrawal(bytes32 cnicHash, uint256 amount)
        external
        onlyRole(gov.BANK_ROLE())
        systemNotPaused
        notBlacklisted(cnicHash)
        nonReentrant
    {
        BeneficiaryRecord storage r = beneficiaries[cnicHash];

        require(
            r.status == Status.CARD_ISSUED || r.status == Status.ACTIVE,
            "GRC: Card not issued"
        );
        require(!_isCycleExpired(r), "GRC: Quarterly cycle has expired");
        require(amount > 0, "Amount must be > 0");
        require(
            r.cashWithdrawn + amount <= gov.maxCashWithdrawalPerQuarter(),
            "GRC: Exceeds maximum cash withdrawal limit (10,000 PKR)"
        );
        require(
            r.cashWithdrawn + r.vendorSpent + amount <= r.quarterlyBalance,
            "GRC: Insufficient quarterly balance"
        );

        r.cashWithdrawn += amount;
        r.status         = Status.ACTIVE;

        uint256 remaining = r.quarterlyBalance - r.cashWithdrawn - r.vendorSpent;
        emit CashWithdrawal(cnicHash, amount, remaining, msg.sender);
    }

    /**
     * @notice Rule 3.2 — Beneficiary makes a purchase at a registered vendor.
     *         No hard cap on vendor spending beyond the quarterly balance.
     */
    function recordVendorSpend(bytes32 cnicHash, uint256 amount)
        external
        onlyRole(gov.BANK_ROLE())
        systemNotPaused
        notBlacklisted(cnicHash)
        nonReentrant
    {
        BeneficiaryRecord storage r = beneficiaries[cnicHash];

        require(
            r.status == Status.CARD_ISSUED || r.status == Status.ACTIVE,
            "GRC: Card not issued"
        );
        require(!_isCycleExpired(r), "GRC: Quarterly cycle has expired");
        require(amount > 0, "Amount must be > 0");
        require(
            r.cashWithdrawn + r.vendorSpent + amount <= r.quarterlyBalance,
            "GRC: Insufficient quarterly balance"
        );

        r.vendorSpent += amount;
        r.status       = Status.ACTIVE;
        r.totalReceivedLifetime += amount; // vendor spend counts as "received"

        uint256 remaining = r.quarterlyBalance - r.cashWithdrawn - r.vendorSpent;
        emit VendorPurchase(cnicHash, amount, remaining, msg.sender);
    }

    /**
     * @notice Rule 3.5 — Bank reclaims unspent funds after 90-day cycle expiry.
     *         Sends the unused balance back to the SBP global budget.
     */
    function reclaimExpiredFunds(bytes32 cnicHash)
        external
        onlyRole(gov.BANK_ROLE())
        nonReentrant
    {
        BeneficiaryRecord storage r = beneficiaries[cnicHash];

        require(
            r.status == Status.CARD_ISSUED || r.status == Status.ACTIVE,
            "GRC: No active card to reclaim"
        );
        require(_isCycleExpired(r), "GRC: Cycle has not yet expired");
        require(!r.fundsExpired,    "GRC: Already reclaimed");

        uint256 unspent = r.quarterlyBalance - r.cashWithdrawn - r.vendorSpent;

        r.fundsExpired     = true;
        r.quarterlyBalance = 0;

        emit FundsExpiredReclaimed(cnicHash, unspent, block.timestamp);
    }


    // ─────────────────────────────────────────────────────────────────────────
    // AUDITOR FUNCTIONS  (AUDITOR_ROLE)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Rule 4.2 — Auditor flags a system anomaly.
     *         Emits a high-priority event directed at the SBP dashboard.
     * @param reasonCode  e.g. "MASS_CARD_ISSUANCE", "DUPLICATE_WITHDRAWAL", "POLICY_BREACH"
     */
    function flagAnomaly(bytes32 cnicHash, string calldata reasonCode)
        external
        onlyRole(gov.AUDITOR_ROLE())
    {
        anomalyReports.push(AnomalyReport({
            cnicHash:  cnicHash,
            reasonCode: reasonCode,
            flaggedBy: msg.sender,
            timestamp: block.timestamp
        }));

        emit AnomalyFlagged(cnicHash, reasonCode, msg.sender, block.timestamp);
    }


    // ─────────────────────────────────────────────────────────────────────────
    // VIEW / READ FUNCTIONS  (public — Auditors, SBP, anyone)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Full audit log for a specific beneficiary.
    function getAuditLog(bytes32 cnicHash) external view returns (AuditEntry[] memory) {
        return _auditLog[cnicHash];
    }

    /// @notice Total number of anomaly reports filed by the Auditor.
    function anomalyCount() external view returns (uint256) {
        return anomalyReports.length;
    }

    /// @notice Returns the remaining spendable balance for a beneficiary this cycle.
    function remainingBalance(bytes32 cnicHash) external view returns (uint256) {
        BeneficiaryRecord storage r = beneficiaries[cnicHash];
        if (r.quarterlyBalance == 0) return 0;
        return r.quarterlyBalance - r.cashWithdrawn - r.vendorSpent;
    }

    /// @notice Returns true if the beneficiary's quarterly cycle has expired.
    function isCycleExpired(bytes32 cnicHash) external view returns (bool) {
        return _isCycleExpired(beneficiaries[cnicHash]);
    }


    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    function _isCycleExpired(BeneficiaryRecord storage r)
        internal
        view
        returns (bool)
    {
        if (r.cycleStartTimestamp == 0) return false;
        return block.timestamp > r.cycleStartTimestamp + gov.EXPIRY_DURATION();
    }

    function _writeAudit(
        bytes32 cnicHash,
        Status  newStatus,
        string  memory reason,
        address actor
    ) internal {
        _auditLog[cnicHash].push(AuditEntry({
            newStatus:  newStatus,
            reasonCode: reason,
            actor:      actor,
            timestamp:  block.timestamp
        }));
    }
}
