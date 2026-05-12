"""
Web Controllers — Form-based handlers for the Jinja2/HTMX frontend.

These controllers parse HTML form data (request.form), set Flask sessions,
and return HTML responses. The existing JSON API controllers are untouched.
"""
import logging
import re
import bcrypt
from flask import request, session, make_response, g
from pydantic import BaseModel, field_validator, model_validator

from app.models.db import get_db
from app.services.blockchain_service import on_chain_log_application
from app.services.verification_service import run_verification_pipeline
from app.services.otp_service import send_otp, verify_otp
from app.middleware.session_auth import ROLE_HOME, BENEFICIARY

logger = logging.getLogger(__name__)
SALT_ROUNDS = 12

_DUMMY_HASH = bcrypt.hashpw(b"dummy_password_for_timing", bcrypt.gensalt(rounds=12))


# ── Pydantic Models ────────────────────────────────────────────────────────────

class WebSignupInput(BaseModel):
    username:        str
    phone_number:    str
    password:        str
    confirmPassword: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        if len(v) > 100:
            raise ValueError("Username must be at most 100 characters")
        if not re.match(r"^[a-zA-Z0-9_]+$", v):
            raise ValueError("Username can only contain letters, numbers, and underscores")
        return v

    @field_validator("phone_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        if not re.match(r"^(\+92|0)[0-9]{10}$", v.strip()):
            raise ValueError("Phone must be a valid Pakistani number (e.g. 03001234567)")
        return v.strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        if not re.search(r"[!@#$%^&*()\-_=+\[\]{};':\"\\|,.<>/?]", v):
            raise ValueError("Password must contain at least one special character")
        return v

    @model_validator(mode="after")
    def passwords_match(self) -> "WebSignupInput":
        if self.password != self.confirmPassword:
            raise ValueError("Passwords do not match")
        return self


class WebLoginInput(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Username is required")
        return v.strip()

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v:
            raise ValueError("Password is required")
        return v


class WebRegistrationInput(BaseModel):
    full_name: str
    cnic:      str
    address:   str
    city:      str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Full name must be at least 3 characters")
        if len(v) > 150:
            raise ValueError("Full name must be at most 150 characters")
        if not re.match(r"^[a-zA-Z\s]+$", v):
            raise ValueError("Full name can only contain letters and spaces")
        return v

    @field_validator("cnic")
    @classmethod
    def validate_cnic(cls, v: str) -> str:
        if not re.match(r"^([0-9]{13}|[0-9]{5}-[0-9]{7}-[0-9]{1})$", v.strip()):
            raise ValueError("CNIC must be 13 digits or format: XXXXX-XXXXXXX-X")
        return v.strip()

    @field_validator("address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Address must be at least 10 characters")
        if len(v) > 500:
            raise ValueError("Address must be at most 500 characters")
        return v

    @field_validator("city")
    @classmethod
    def validate_city(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("City must be at least 2 characters")
        if len(v) > 100:
            raise ValueError("City must be at most 100 characters")
        return v


# ── Login ──────────────────────────────────────────────────────────────────────

def web_login():
    """Validate credentials, set Flask session, return HTMX redirect on success."""
    try:
        body = WebLoginInput.model_validate({
            "username": request.form.get("username", ""),
            "password": request.form.get("password", ""),
        })
    except Exception as e:
        msg = _first_error(e)
        return _error_fragment(msg), 422

    db = get_db()
    user = db.users.find_unique(where={"username": body.username})

    stored_hash = user.password_hash.encode("utf-8") if user else _DUMMY_HASH
    password_match = bcrypt.checkpw(body.password.encode("utf-8"), stored_hash)

    if not user or not password_match:
        return _error_fragment("Invalid username or password."), 401

    session.permanent = True
    session["user_id"]  = user.user_id
    session["username"] = user.username
    session["role"]     = user.role

    home = ROLE_HOME.get(user.role, "/dashboard")
    resp = make_response("", 200)
    resp.headers["HX-Redirect"] = home
    return resp


# ── Signup — Step 1: Validate & send OTP ─────────────────────────────────────

def web_signup():
    """
    STEP 1 of 2: Validate signup form, check for duplicates, send OTP to phone.
    Stores hashed password + form data in session (not DB) until OTP is verified.
    Returns the OTP verification HTML fragment for HTMX to swap into the page.
    """
    try:
        body = WebSignupInput.model_validate({
            "username":        request.form.get("username", ""),
            "phone_number":    request.form.get("phone_number", ""),
            "password":        request.form.get("password", ""),
            "confirmPassword": request.form.get("confirmPassword", ""),
        })
    except Exception as e:
        return _error_fragment(_first_error(e)), 422

    # Check duplicates BEFORE sending OTP (avoid sending SMS to already-used numbers)
    db = get_db()
    if db.users.find_unique(where={"username": body.username}):
        return _error_fragment("An account with these credentials already exists."), 409
    if db.users.find_unique(where={"phone_number": body.phone_number}):
        return _error_fragment("An account with these credentials already exists."), 409

    # Hash password now — do NOT store plain text anywhere, even in session
    pw_hash = bcrypt.hashpw(
        body.password.encode("utf-8"), bcrypt.gensalt(rounds=SALT_ROUNDS)
    ).decode("utf-8")

    # Send OTP via Twilio Verify
    ok, msg = send_otp(body.phone_number)
    if not ok:
        return _error_fragment(msg), 503

    # Store pending registration data in session (expires with browser session)
    session["pending_signup"] = {
        "username":      body.username,
        "phone_number":  body.phone_number,
        "password_hash": pw_hash,
    }

    # Return OTP input fragment for HTMX to swap into #form-error target
    masked = body.phone_number[:4] + "****" + body.phone_number[-3:]
    return f'''
    <div id="otp-verify-section" class="space-y-4">
      <div class="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <svg class="w-5 h-5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.56 3.42 2 2 0 0 1 3.54 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78A16 16 0 0 0 12 12l.88-.88a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 20 13.34v3z"/>
        </svg>
        <div>
          <p class="text-sm font-semibold text-emerald-400">OTP Sent!</p>
          <p class="text-xs text-slate-400">A 6-digit code was sent to <strong>{masked}</strong></p>
          <p class="urdu-text text-xs text-slate-500 mt-0.5">تصدیقی کوڈ آپ کے فون پر بھیج دیا گیا ہے</p>
        </div>
      </div>
      <form id="otp-form"
            hx-post="/signup/verify"
            hx-target="#otp-verify-section"
            hx-swap="outerHTML"
            class="space-y-4">
        <input type="hidden" name="csrf_token" value="{_get_csrf()}" />
        <div>
          <label class="form-label">Enter 6-Digit Code</label>
          <p class="urdu-text text-xs text-slate-500 mb-2">6 ہندسوں کا کوڈ درج کریں</p>
          <input
            id="otp-input"
            name="otp_code"
            type="text"
            inputmode="numeric"
            maxlength="6"
            pattern="[0-9]{{6}}"
            required
            placeholder="e.g. 123456"
            autocomplete="one-time-code"
            class="form-input text-center text-2xl font-mono tracking-[0.5em]"
          />
        </div>
        <button type="submit" class="btn-primary">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Verify &amp; Create Account
        </button>
        <p class="text-xs text-slate-600 text-center">Code expires in 10 minutes.</p>
      </form>
    </div>
    ''', 200


# ── Signup — Step 2: Verify OTP & create account ──────────────────────────────

def web_signup_verify():
    """
    STEP 2 of 2: Verify the OTP entered by the user.
    If correct, create the user account in the database and log them in.
    """
    pending = session.get("pending_signup")
    if not pending:
        return _error_fragment("Session expired. Please start signup again."), 400

    code = request.form.get("otp_code", "").strip()
    if not code or len(code) != 6 or not code.isdigit():
        return _error_fragment("Please enter a valid 6-digit OTP code."), 422

    ok, msg = verify_otp(pending["phone_number"], code)
    if not ok:
        return _error_fragment(msg), 422

    # OTP verified — now create the user in the database
    db = get_db()
    try:
        new_user = db.users.create(data={
            "username":      pending["username"],
            "phone_number":  pending["phone_number"],
            "password_hash": pending["password_hash"],
            "role":          "BENEFICIARY",
        })
    except Exception as err:
        s = str(err)
        if "Unique constraint" in s or "unique" in s.lower():
            session.pop("pending_signup", None)
            return _error_fragment("An account with these credentials already exists."), 409
        logger.error("[WebAuth] Signup DB error: %s", err)
        return _error_fragment("An internal server error occurred."), 500

    # Clean up pending data from session, then log the user in
    session.pop("pending_signup", None)
    session.permanent   = True
    session["user_id"]  = new_user.user_id
    session["username"] = new_user.username
    session["role"]     = new_user.role

    resp = make_response("", 200)
    resp.headers["HX-Redirect"] = "/dashboard"
    return resp


# ── Apply for Aid ─────────────────────────────────────────────────────────────

def web_apply():
    """Submit aid application form, run pipeline, redirect to status page."""
    try:
        body = WebRegistrationInput.model_validate({
            "full_name": request.form.get("full_name", ""),
            "cnic":      request.form.get("cnic", ""),
            "address":   request.form.get("address", ""),
            "city":      request.form.get("city", ""),
        })
    except Exception as e:
        return _error_fragment(_first_error(e)), 422

    user_id = g.current_user["userId"]
    db = get_db()
    normalized_cnic = body.cnic.replace("-", "").strip()

    if db.registration.find_first(where={"user_id": user_id}):
        return _error_fragment("You have already submitted an application."), 409

    if db.registration.find_unique(where={"cnic": normalized_cnic}):
        return _error_fragment("An application with this CNIC already exists."), 409

    reg = db.registration.create(data={
        "user_id":         user_id,
        "cnic":            normalized_cnic,
        "full_name":       body.full_name,
        "address":         body.address,
        "city":            body.city,
        "pipeline_status": "PENDING",
    })

    try:
        on_chain_log_application(normalized_cnic)
    except Exception as err:
        logger.error("[Blockchain] logApplication FAILED (non-fatal): %s", err)

    run_verification_pipeline(normalized_cnic, reg.registration_id)

    resp = make_response("", 200)
    resp.headers["HX-Redirect"] = "/dashboard/status"
    return resp


# ── Data Fetchers ─────────────────────────────────────────────────────────────

def web_get_status():
    """Returns registration + relations for the session user, or None."""
    user_id = g.current_user["userId"]
    db = get_db()
    return db.registration.find_first(
        where={"user_id": user_id},
        include={
            "notifications": {"order_by": {"created_at": "desc"}, "take": 10},
            "eligible":      True,
            "card_issue":    True,
        },
    )


def web_get_notifications():
    """Returns all notifications for the session user."""
    user_id = g.current_user["userId"]
    db = get_db()
    reg = db.registration.find_first(
        where={"user_id": user_id},
        include={"notifications": {"order_by": {"created_at": "desc"}}},
    )
    return reg.notifications if reg else []


# ── Helpers ───────────────────────────────────────────────────────────────────

def _first_error(exc) -> str:
    if hasattr(exc, "errors") and exc.errors():
        return exc.errors()[0]["msg"]
    return str(exc)


def _error_fragment(message: str) -> str:
    return (
        '<div class="form-error flex items-center gap-2 text-red-400 text-sm '
        'bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">'
        '<svg class="w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
        'fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/>'
        '<line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
        f"{message}</div>"
    )


def _get_csrf() -> str:
    """Generate a fresh CSRF token for use inside dynamically generated HTML fragments."""
    from app.utils.csrf import get_csrf_token
    return get_csrf_token()
