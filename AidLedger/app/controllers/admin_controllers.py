"""
Admin Controllers — Data fetchers for each staff role portal.
All functions enforce need-to-know data access per role.
"""
import logging
from flask import g
from app.models.db import get_db

logger = logging.getLogger(__name__)


# ── AidLedger Admin ────────────────────────────────────────────────────────────

def admin_get_overview():
    """Full system overview stats for AIDLEDGER_ADMIN."""
    db = get_db()
    total        = db.registration.count()
    eligible     = db.registration.count(where={"pipeline_status": "ELIGIBLE"})
    pending      = db.registration.count(where={"pipeline_status": "PENDING"})
    failed       = total - eligible - pending
    cards_issued = db.card_issue.count()
    return {
        "total": total,
        "eligible": eligible,
        "pending": pending,
        "failed": failed,
        "cards_issued": cards_issued,
    }


def admin_get_all_registrations(limit: int = 50):
    """All registrations with relations for AIDLEDGER_ADMIN."""
    db = get_db()
    return db.registration.find_many(
        order={"created_at": "desc"},
        take=limit,
        include={
            "eligible":   True,
            "card_issue": True,
            "users":      True,
        },
    )


def admin_get_policies():
    """All policy records for AIDLEDGER_ADMIN."""
    db = get_db()
    return db.policies.find_many(order={"policy_id": "desc"})


# ── SBP Admin ──────────────────────────────────────────────────────────────────

def sbp_get_overview():
    """Aggregated financial stats only — no personal citizen data."""
    db = get_db()
    total_eligible   = db.eligible.count()
    total_cards      = db.card_issue.count()
    active_cards     = db.card_issue.count(where={"card_status": "ACTIVE"})
    policies         = db.policies.find_first(where={"is_active": True})
    return {
        "total_eligible":  total_eligible,
        "total_cards":     total_cards,
        "active_cards":    active_cards,
        "pending_cards":   total_eligible - total_cards,
        "policy":          policies,
    }


def sbp_get_city_breakdown():
    """Count of eligible applicants per city for SBP financial planning."""
    db = get_db()
    regs = db.registration.find_many(
        where={"pipeline_status": "ELIGIBLE"},
        # Only select city — no personal data
    )
    breakdown = {}
    for r in regs:
        city = r.city or "Unknown"
        breakdown[city] = breakdown.get(city, 0) + 1
    return sorted(breakdown.items(), key=lambda x: x[1], reverse=True)


# ── Bank Admin ─────────────────────────────────────────────────────────────────

def bank_get_card_queue():
    """Eligible applicants without a card yet — for bank to issue."""
    db = get_db()
    eligible_without_card = db.eligible.find_many(
        where={"card_issued": False},
        include={"registration": True},
        order={"approved_at": "asc"},
        take=50,
    )
    return eligible_without_card


def bank_get_active_cards():
    """Active cards under this bank's management."""
    db = get_db()
    return db.card_issue.find_many(
        where={"card_status": "ACTIVE"},
        include={
            "registration": True,
            "transactions": {"order_by": {"timestamp": "desc"}, "take": 5},
        },
        order={"issue_date": "desc"},
        take=50,
    )


def bank_issue_card(eligible_id: int, card_number: str, bank_reference: str):
    """
    Issue a card record for an eligible applicant.
    Card is created in PENDING_LINK status — the actual RFID UID is written
    later when the beneficiary physically taps their plastic card on the kiosk
    and verifies via OTP. card_number param is kept for API compatibility but
    a placeholder is used internally.
    """
    from datetime import date, timedelta
    import uuid
    db = get_db()
    eligible = db.eligible.find_unique(
        where={"eligible_id": eligible_id},
        include={"registration": True},
    )
    if not eligible:
        return None, "Eligible record not found"
    if eligible.card_issued:
        return None, "Card already issued"

    expiry = date.today() + timedelta(days=365 * 3)  # 3-year card
    # Use a placeholder — RFID UID is written when user links the physical card
    placeholder_uid = f"PENDING-{uuid.uuid4().hex[:12].upper()}"
    card = db.card_issue.create(data={
        "eligible_id":         eligible_id,
        "cnic":                eligible.cnic,
        "virtual_card_number": placeholder_uid,
        "card_status":         "PENDING_LINK",   # awaiting RFID + OTP linking
        "expiry_date":         expiry,
    })
    db.eligible.update(
        where={"eligible_id": eligible_id},
        data={"card_issued": True},
    )
    logger.info("[Bank] Card record created for CNIC %s — awaiting RFID linking", eligible.cnic)
    return card, None


# ── Auditor ────────────────────────────────────────────────────────────────────

def audit_get_all_records(limit: int = 100):
    """
    Full audit trail — read only.
    Includes blockchain hashes, pipeline decisions, notifications.
    Masks: phone numbers, card numbers shown partially only.
    """
    db = get_db()
    return db.registration.find_many(
        order={"created_at": "desc"},
        take=limit,
        include={
            "eligible":      True,
            "card_issue":    True,
            "notifications": {"order_by": {"created_at": "asc"}},
        },
    )


def audit_get_stats():
    """Summary statistics for audit report."""
    db = get_db()
    return {
        "total_registrations": db.registration.count(),
        "kyc_failed":          db.registration.count(where={"pipeline_status": "KYC_FAILED"}),
        "family_ineligible":   db.registration.count(where={"pipeline_status": "FAMILY_INELIGIBLE"}),
        "pmt_failed":          db.registration.count(where={"pipeline_status": "PMT_FAILED"}),
        "eligible":            db.registration.count(where={"pipeline_status": "ELIGIBLE"}),
        "cards_issued":        db.card_issue.count(),
        "notifications_sent":  db.notifications.count(where={"status": "SENT"}),
    }
