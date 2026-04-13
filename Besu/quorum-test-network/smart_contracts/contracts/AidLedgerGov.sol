// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AidLedgerGov
 * @author AidLedger
 * @notice GRC Governance Contract — defines all roles and policies for the
 *         AidLedger humanitarian aid distribution programme.
 *
 * ENTITY HIERARCHY
 * ─────────────────────────────────────────────────
 * SBP (DEFAULT_ADMIN_ROLE)  ← highest authority
 *   └─ AidLedger (AIDLEDGER_ROLE)
 *        ├─ Bank     (BANK_ROLE)
 *        └─ Auditor  (AUDITOR_ROLE)
 */
contract AidLedgerGov is AccessControl, Pausable {

    // ─────────────────────────────────────────────────────────────────────────
    // ROLES
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice SBP holds DEFAULT_ADMIN_ROLE (from AccessControl) — no extra declaration needed.

    /// @notice Operational admin — can set eligibility criteria and payout amounts.
    bytes32 public constant AIDLEDGER_ROLE = keccak256("AIDLEDGER_ROLE");

    /// @notice Financial executor — can issue cards and record withdrawals.
    bytes32 public constant BANK_ROLE = keccak256("BANK_ROLE");

    /// @notice Compliance watchdog — can read state and flag anomalies.
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");


    // ─────────────────────────────────────────────────────────────────────────
    // SBP MACRO POLICY  (Rule 1.2 – 1.6)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Rule 1.2 — Total programme budget set by SBP (350 Billion PKR).
    ///         Represented in PKR smallest unit (1 PKR = 1e2 paisa — keep it simple).
    uint256 public globalProgramBudget;

    /// @notice Rule 1.3 — Hard ceiling: no citizen can receive more than 100,000 PKR
    ///         across the lifetime of the programme.
    uint256 public absoluteMaxPerCitizen;

    /// @notice Rule 1.6 — KYC is mandatory. Can only be disabled by SBP for testing.
    bool public kycMandatory;

    /// @notice Rule 1.5 — Blacklisted CNIC hashes (permanent fraud block).
    mapping(bytes32 => bool) public isBlacklisted;

    /// @notice Tracks lifetime disbursements per cnicHash (enforces Rule 1.3).
    mapping(bytes32 => uint256) public lifetimeDisbursed;

    /// @notice Total funds disbursed so far from the global budget.
    uint256 public totalDisbursed;


    // ─────────────────────────────────────────────────────────────────────────
    // AIDLEDGER MICRO POLICY  (Rule 2.2 – 2.4)
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Rule 2.2 — Quarterly disbursement amount (25,000 PKR).
    uint256 public quarterlyDisbursementAmount;

    /// @notice Rule 3.2 — Maximum cash a beneficiary may withdraw per quarter (10,000 PKR).
    ///         The remaining 15,000 PKR must be spent at registered vendors.
    uint256 public maxCashWithdrawalPerQuarter;

    /// @notice Rule 3.2 — Remainder that must go to vendor purchases (15,000 PKR).
    uint256 public vendorAllocation;

    /// @notice Rule 2.1 — PMT Score thresholds (stored as integers × 100 to avoid decimals).
    ///         urbanMaxPmtScore = 3800 means 38.00. ruralMaxPmtScore = 3200 means 32.00.
    ///         A lower score = more poverty. Applicant must score BELOW their zone's threshold.
    uint256 public urbanMaxPmtScore;
    uint256 public ruralMaxPmtScore;

    /// @notice Duration of each disbursement cycle in seconds (90 days = 1 quarter).
    uint256 public constant CYCLE_DURATION = 90 days;

    /// @notice Rule 3.5 — Funds expire after this many days if unclaimed.
    uint256 public constant EXPIRY_DURATION = 90 days;


    // ─────────────────────────────────────────────────────────────────────────
    // EVENTS
    // ─────────────────────────────────────────────────────────────────────────

    event MacroPolicyUpdated(
        uint256 newGlobalBudget,
        uint256 newAbsoluteMaxPerCitizen,
        address updatedBy
    );

    event MicroPolicyUpdated(
        uint256 newQuarterlyAmount,
        uint256 newCashLimit,
        uint256 newVendorAllocation,
        address updatedBy
    );

    event PmtPolicyUpdated(
        uint256 newUrbanThreshold,
        uint256 newRuralThreshold,
        address updatedBy
    );

    event CniBlacklisted(bytes32 indexed cnicHash, address blacklistedBy);
    event CniBlacklistRevoked(bytes32 indexed cnicHash, address revokedBy);
    event BudgetConsumed(uint256 amount, uint256 remainingBudget);


    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCTOR
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param sbpAddress      Wallet address of the SBP node — gets DEFAULT_ADMIN_ROLE.
     * @param aidLedgerAddr   Wallet address of the AidLedger node.
     * @param bankAddress     Wallet address of the Bank node.
     * @param auditorAddress  Wallet address of the Auditor node.
     */
    constructor(
        address sbpAddress,
        address aidLedgerAddr,
        address bankAddress,
        address auditorAddress
    ) {
        require(sbpAddress     != address(0), "SBP address required");
        require(aidLedgerAddr  != address(0), "AidLedger address required");
        require(bankAddress    != address(0), "Bank address required");
        require(auditorAddress != address(0), "Auditor address required");

        // ── Role setup ───────────────────────────────────────────────────────
        _grantRole(DEFAULT_ADMIN_ROLE, sbpAddress);   // SBP is supreme
        _grantRole(AIDLEDGER_ROLE,     aidLedgerAddr);
        _grantRole(BANK_ROLE,          bankAddress);
        _grantRole(AUDITOR_ROLE,       auditorAddress);

        // ── SBP Macro Policies (Rule 1.2 & 1.3) ─────────────────────────────
        globalProgramBudget    = 350_000_000_000; // 350 Billion PKR
        absoluteMaxPerCitizen  = 100_000;         // 100,000 PKR

        kycMandatory = true;

        // ── AidLedger Micro Policies (Rule 2.2) ──────────────────────────────
        quarterlyDisbursementAmount = 25_000;     // 25,000 PKR per quarter
        maxCashWithdrawalPerQuarter = 10_000;     // Rule 3.2 — cash cap
        vendorAllocation            = 15_000;     // Rule 3.2 — vendor-only spend

        // ── PMT Geographic Thresholds (Rule 2.1) ─────────────────────────────
        // Stored ×100 to avoid decimals (3800 = score of 38.00)
        urbanMaxPmtScore = 3_800;               // Urban residents — higher threshold (38.00)
        ruralMaxPmtScore = 3_200;               // Rural residents — stricter threshold (32.00)
    }


    // ─────────────────────────────────────────────────────────────────────────
    // SBP FUNCTIONS  (DEFAULT_ADMIN_ROLE only)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Rule 1.2 & 1.3 — SBP updates the macro policy parameters.
     */
    function updateMacroPolicy(
        uint256 _globalBudget,
        uint256 _maxPerCitizen
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_globalBudget   > totalDisbursed,  "Budget below already-disbursed total");
        require(_maxPerCitizen  > 0,               "Max per citizen must be greater than 0");

        globalProgramBudget   = _globalBudget;
        absoluteMaxPerCitizen = _maxPerCitizen;

        emit MacroPolicyUpdated(_globalBudget, _maxPerCitizen, msg.sender);
    }

    /**
     * @notice Rule 1.4 — SBP activates the system-wide circuit breaker.
     */
    function pauseSystem() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Rule 1.4 — SBP deactivates the circuit breaker.
     */
    function unpauseSystem() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Rule 1.5 — SBP permanently blacklists a CNIC hash.
     * @param cnicHash  keccak256-hashed CNIC (never store raw CNIC on-chain).
     */
    function blacklistCnic(bytes32 cnicHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!isBlacklisted[cnicHash], "Already blacklisted");
        isBlacklisted[cnicHash] = true;
        emit CniBlacklisted(cnicHash, msg.sender);
    }

    /**
     * @notice Rule 1.5 — SBP revokes a blacklist entry (corrective action).
     */
    function revokeBlacklist(bytes32 cnicHash) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(isBlacklisted[cnicHash], "Not blacklisted");
        isBlacklisted[cnicHash] = false;
        emit CniBlacklistRevoked(cnicHash, msg.sender);
    }

    /**
     * @notice Rule 1.6 — Toggle KYC requirement (emergency / testing only).
     */
    function setKycMandatory(bool _mandatory) external onlyRole(DEFAULT_ADMIN_ROLE) {
        kycMandatory = _mandatory;
    }


    // ─────────────────────────────────────────────────────────────────────────
    // AIDLEDGER FUNCTIONS  (AIDLEDGER_ROLE only)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Rule 2.2 & 3.2 — AidLedger adjusts the quarterly disbursement
     *         and the Cash / Vendor split. The sum of cashLimit + vendorPart
     *         must equal the new quarterly amount, and the quarterly amount
     *         CANNOT exceed SBP's absoluteMaxPerCitizen.
     */
    function updateMicroPolicy(
        uint256 _quarterlyAmount,
        uint256 _cashLimit,
        uint256 _vendorAllocation
    ) external onlyRole(AIDLEDGER_ROLE) whenNotPaused {
        require(
            _quarterlyAmount <= absoluteMaxPerCitizen,
            "GRC Violation: Exceeds SBP absoluteMaxPerCitizen"
        );
        require(
            _cashLimit + _vendorAllocation == _quarterlyAmount,
            "GRC Violation: Cash + Vendor must equal quarterly amount"
        );
        require(_cashLimit > 0 && _vendorAllocation > 0, "Both limits must be > 0");

        quarterlyDisbursementAmount = _quarterlyAmount;
        maxCashWithdrawalPerQuarter = _cashLimit;
        vendorAllocation            = _vendorAllocation;

        emit MicroPolicyUpdated(_quarterlyAmount, _cashLimit, _vendorAllocation, msg.sender);
    }

    /**
     * @notice Rule 2.1 — AidLedger updates the geographic PMT score thresholds.
     *         Values are supplied ×100 (e.g., 3800 = 38.00 threshold).
     *         AidLedger can adjust these seasonally. SBP can override via updateMacroPolicy.
     */
    function updatePmtPolicy(
        uint256 _urbanMaxPmtScore,
        uint256 _ruralMaxPmtScore
    ) external onlyRole(AIDLEDGER_ROLE) whenNotPaused {
        require(_urbanMaxPmtScore > _ruralMaxPmtScore, "GRC: Urban threshold must exceed Rural");
        require(_urbanMaxPmtScore <= 10_000, "GRC: Threshold cannot exceed 100.00");

        urbanMaxPmtScore = _urbanMaxPmtScore;
        ruralMaxPmtScore = _ruralMaxPmtScore;

        emit PmtPolicyUpdated(_urbanMaxPmtScore, _ruralMaxPmtScore, msg.sender);
    }


    // ─────────────────────────────────────────────────────────────────────────
    // INTERNAL HELPERS  (called by AidRegistry)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Deducts `amount` from the global programme budget.
     *         Called by AidRegistry when a quarterly disbursement is confirmed.
     */
    function consumeBudget(bytes32 cnicHash, uint256 amount)
        external
        onlyRole(AIDLEDGER_ROLE)
        whenNotPaused
    {
        require(!isBlacklisted[cnicHash],           "Blacklisted CNIC");
        require(totalDisbursed + amount <= globalProgramBudget, "Global budget exhausted");
        require(
            lifetimeDisbursed[cnicHash] + amount <= absoluteMaxPerCitizen,
            "GRC Violation: Lifetime cap exceeded"
        );

        totalDisbursed                    += amount;
        lifetimeDisbursed[cnicHash]       += amount;

        emit BudgetConsumed(amount, globalProgramBudget - totalDisbursed);
    }


    // ─────────────────────────────────────────────────────────────────────────
    // VIEWS
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Remaining global budget available for disbursement.
    function remainingGlobalBudget() external view returns (uint256) {
        return globalProgramBudget - totalDisbursed;
    }

    /// @notice How much a specific citizen can still receive before hitting the cap.
    function remainingCitizenAllowance(bytes32 cnicHash) external view returns (uint256) {
        return absoluteMaxPerCitizen - lifetimeDisbursed[cnicHash];
    }
}
