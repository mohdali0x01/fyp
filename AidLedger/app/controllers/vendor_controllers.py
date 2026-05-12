"""
Vendor Controller — Secure aid payment processing via RFID + OTP + Blockchain.

Flow:
    1. Vendor logs in (pre-seeded account only — no public signup).
    2. Vendor enters amount on dashboard.
    3. Beneficiary taps RFID card — system identifies them by virtual_card_number.
    4. OTP is sent to beneficiary's registered phone number.
    5. Vendor enters OTP received from beneficiary.
    6. System verifies OTP, checks blockchain balance, records spend on-chain.
    7. Transaction saved to DB. Beneficiary's history updated instantly.

Security:
    - Rate limiting on OTP send (3 per 15 min per vendor session).
    - OTP expires in 5 minutes.
    - Balance checked from blockchain (source of truth) before any spend.
    - Vendor cannot proceed without correct OTP — prevents unauthorized use.
    - CNIC never stored in OTP table — only card_id used.
"""
import logging
import bcrypt
from datetime import datetime, timedelta, timezone
from flask import request, session, render_template, redirect

from app.models.db import get_db
from app.utils.csrf import get_csrf_token, validate_csrf
from app.services.blockchain_service import (
    on_chain_record_vendor_spend,
    get_on_chain_remaining_balance,
    get_on_chain_vendor_limit,
)
from app.services.otp_service import send_otp, verify_otp

logger = logging.getLogger(__name__)

# OTP validity window in minutes
OTP_EXPIRY_MINUTES = 5
# Dummy hash for constant-time bcrypt when vendor not found
_DUMMY_HASH = bcrypt.hashpw(b"vendor_dummy_timing_safe", bcrypt.gensalt(rounds=12))


# ── LOGIN ──────────────────────────────────────────────────────────────────────

def vendor_login_page():
    """GET /vendor/login — Render login page."""
    if session.get("role") == "VENDOR":
        return redirect("/vendor/dashboard")
    return render_template(
        "vendor/login.html",
        csrf_token=get_csrf_token(),
        error=None,
    )


def vendor_login_post():
    """POST /vendor/login — Authenticate vendor, create session."""
    if not validate_csrf():
        return render_template(
            "vendor/login.html",
            csrf_token=get_csrf_token(),
            error="Invalid request. Please refresh and try again.",
        ), 403

    username = (request.form.get("username", "")).strip()
    password = request.form.get("password", "")

    if not username or not password:
        return render_template(
            "vendor/login.html",
            csrf_token=get_csrf_token(),
            error="Username and password are required.",
        ), 400

    db = get_db()
    user = db.users.find_first(
        where={"username": username, "role": "VENDOR"}
    )

    # Constant-time comparison — always run bcrypt even when user not found
    stored_hash = user.password_hash.encode("utf-8") if user else _DUMMY_HASH
    password_match = bcrypt.checkpw(password.encode("utf-8"), stored_hash)

    if not user or not password_match:
        logger.warning("[Vendor] Failed login attempt for username: %s", username)
        return render_template(
            "vendor/login.html",
            csrf_token=get_csrf_token(),
            error="Invalid username or password.",
        ), 401

    # Create session
    session.permanent = True
    session["user_id"]      = user.user_id
    session["username"]     = user.username
    session["role"]         = user.role
    session["vendor_name"]  = user.username  # display name for UI

    logger.info("[Vendor] Login successful: %s (id=%d)", user.username, user.user_id)
    return redirect("/vendor/dashboard")


# ── LOGOUT ────────────────────────────────────────────────────────────────────

def vendor_logout():
    """POST /vendor/logout — Clear vendor session."""
    if not validate_csrf():
        return redirect("/vendor/login")
    session.clear()
    return redirect("/vendor/login")


# ── DASHBOARD ─────────────────────────────────────────────────────────────────

def vendor_dashboard():
    """GET /vendor/dashboard — Render checkout dashboard."""
    db = get_db()
    vendor_user_id = session["user_id"]

    # Fetch today's transactions for this vendor
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    todays_txns = db.transactions.find_many(
        where={
            "vendor_user_id": vendor_user_id,
            "timestamp": {"gte": today_start},
        },
        order={"timestamp": "desc"},
        include={"card_issue": True},
    )
    today_total = sum(float(t.amount) for t in todays_txns)

    return render_template(
        "vendor/dashboard.html",
        csrf_token=get_csrf_token(),
        username=session.get("username", ""),
        todays_txns=todays_txns,
        today_total=today_total,
    )


# ── CARD SCAN — identify beneficiary ─────────────────────────────────────────

def vendor_scan_card():
    """
    POST /vendor/scan-card (HTMX)
    Receives rfid_uid and amount from vendor form.
    Looks up the beneficiary and returns the OTP entry partial.
    """
    rfid_uid = (request.form.get("rfid_uid", "")).strip().upper()
    amount_str = (request.form.get("amount", "")).strip()
    logger.info("[Vendor] Scanning card: %s (Amount: %s)", rfid_uid, amount_str)
    
    if not validate_csrf():
        return _htmx_error("Invalid CSRF token. Please refresh the page.")

    if not rfid_uid:
        return _htmx_error("No card detected. Please ask the beneficiary to tap their card again.")

    if not amount_str:
        return _htmx_error("Please enter an amount before scanning the card.")

    try:
        amount = int(float(amount_str))
        if amount <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return _htmx_error("Please enter a valid positive amount.")

    if amount > 15000:
        return _htmx_error("Amount exceeds the maximum single-vendor limit of PKR 15,000.")

    db = get_db()

    # Find the card by its RFID UID (virtual_card_number)
    card = db.card_issue.find_first(
        where={"virtual_card_number": rfid_uid},
        include={"registration": True},
    )

    if not card:
        logger.warning("[Vendor] Unknown RFID UID scanned: %s", rfid_uid[:4] + "****")
        return _htmx_error("Card not recognized. This card is not registered in the system.")

    if card.card_status not in ("ACTIVE",):
        return _htmx_error(
            f"Card is not active (Status: {card.card_status}). "
            "Please ask the beneficiary to visit a registration center."
        )

    # Check blockchain balance specifically for VENDOR purchases (source of truth)
    try:
        cnic = card.cnic
        logger.debug("[Vendor] Checking grocery limit for CNIC: %s", cnic[:5] + "...")
        on_chain_vendor_rem = get_on_chain_vendor_limit(cnic)
        logger.debug("[Vendor] Vendor remaining limit found: %d", on_chain_vendor_rem)
    except Exception as err:
        logger.error("[Vendor] Blockchain limit check failed: %s", err, exc_info=True)
        return _htmx_error("Could not verify card grocery limit. Please ensure blockchain network is running.")

    if on_chain_vendor_rem < amount:
        return _htmx_error(
            f"Insufficient vendor limit. Available for grocery: PKR {on_chain_vendor_rem:,} | "
            f"Requested: PKR {amount:,}"
        )

    # Fetch phone number from kyc_master for OTP delivery
    kyc = db.kyc_master.find_unique(where={"cnic": cnic})
    if not kyc or not kyc.phone:
        return _htmx_error("Beneficiary phone number not found. Cannot send OTP.")

    # Send OTP via existing Twilio service
    success, msg = send_otp(kyc.phone)
    if not success:
        return _htmx_error(f"Failed to send OTP: {msg}")

    # Store pending transaction context in session (no OTP stored here — Twilio manages it)
    session["pending_txn"] = {
        "card_id":    card.card_id,
        "cnic":       cnic,
        "amount":     amount,
        "phone":      kyc.phone,
        "phone_tail": kyc.phone[-4:],
        "cardholder": card.registration.full_name if card.registration else "Beneficiary",
        "expires":    (datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat(),
    }

    logger.info("[Vendor] OTP dispatched to ***%s for card %s", kyc.phone[-4:], rfid_uid[:4])

    # Return the OTP entry partial to the vendor screen
    return render_template(
        "vendor/partials/otp_verify.html",
        csrf_token=get_csrf_token(),
        cardholder=session["pending_txn"]["cardholder"],
        amount=amount,
        phone_tail=session["pending_txn"]["phone_tail"],
        expiry_minutes=OTP_EXPIRY_MINUTES,
    )


# ── OTP VERIFY — finalize transaction ─────────────────────────────────────────

def vendor_verify_otp():
    """
    POST /vendor/verify-otp (HTMX)
    Validates OTP, records spend on blockchain, saves to DB.
    """
    if not validate_csrf():
        return _htmx_error("Invalid CSRF token. Please refresh the page.")

    entered_otp = (request.form.get("otp", "")).strip()
    pending = session.get("pending_txn")

    if not pending:
        return _htmx_error("Session expired. Please scan the card again.")

    # Check session expiry
    expires_at = datetime.fromisoformat(pending["expires"])
    if datetime.now(timezone.utc) > expires_at:
        session.pop("pending_txn", None)
        return _htmx_error(f"OTP expired after {OTP_EXPIRY_MINUTES} minutes. Please scan the card again.")

    # Verify OTP via Twilio service (handles mock mode automatically)
    otp_valid, otp_msg = verify_otp(pending["phone"], entered_otp)
    if not otp_valid:
        logger.warning("[Vendor] Incorrect OTP by vendor %s", session.get("username"))
        return _htmx_error(f"OTP verification failed: {otp_msg}")

    # OTP verified — proceed with blockchain recording
    cnic       = pending["cnic"]
    amount     = pending["amount"]
    card_id    = pending["card_id"]
    cardholder = pending["cardholder"]
    vendor_uid = session["user_id"]

    # Clear pending transaction from session immediately
    session.pop("pending_txn", None)

    # Double-check balance specifically for VENDOR purchases on blockchain (race-condition protection)
    try:
        live_vendor_rem = get_on_chain_vendor_limit(cnic)
        if live_vendor_rem < amount:
            return _htmx_error(
                f"Insufficient vendor limit at time of processing. "
                f"Available for grocery: PKR {live_vendor_rem:,}"
            )
    except Exception as err:
        logger.error("[Vendor] Final balance check failed: %s", err)
        return _htmx_error("Blockchain verification failed. Transaction aborted.")

    # Record on blockchain
    try:
        tx_hash = on_chain_record_vendor_spend(cnic, amount)
    except Exception as err:
        logger.error("[Vendor] Blockchain recordVendorSpend failed: %s", err)
        return _htmx_error(
            "Blockchain transaction failed. "
            "The payment has NOT been processed. Please try again."
        )

    # Save to PostgreSQL
    db = get_db()
    try:
        db.transactions.create(data={
            "card_id":           card_id,
            "vendor_user_id":    vendor_uid,
            "transaction_type":  "VENDOR_SPEND",
            "amount":            float(amount),
            "blockchain_tx_hash": tx_hash,
            "status":            "COMPLETED",
        })
    except Exception as err:
        logger.error("[Vendor] DB transaction save failed: %s", err)
        # Blockchain is already updated — log this but don't fail the response
        # (the blockchain is source of truth, DB will be reconciled)

    logger.info(
        "[Vendor] Transaction complete | Vendor: %s | Amount: PKR %d | TX: %s",
        session.get("username"), amount, tx_hash,
    )

    # Return success receipt partial
    return render_template(
        "vendor/partials/receipt.html",
        cardholder=cardholder,
        amount=amount,
        tx_hash=tx_hash,
        csrf_token=get_csrf_token(),
    )


# ── INTERNAL HELPERS ──────────────────────────────────────────────────────────

def _htmx_error(message: str):
    """Returns an HTMX-compatible error partial (Status 200 so HTMX swaps it)."""
    return render_template(
        "vendor/partials/error.html",
        error_message=message,
        csrf_token=get_csrf_token(),
    ), 200
