"""
Web Routes Blueprint — Jinja2 + HTMX server-rendered pages.
All routes here serve HTML. The /api/* JSON endpoints are untouched.
"""
import logging
import uuid
from markupsafe import Markup
from flask import (
    Blueprint, render_template, session, redirect,
    request, make_response, g, abort, jsonify,
)

from app.middleware.session_auth import (
    login_required, role_required,
    AIDLEDGER_ADMIN, SBP_ADMIN, BANK_ADMIN, AUDITOR, BENEFICIARY, ROLE_HOME,
)
from app.utils.csrf import get_csrf_token, validate_csrf
from app.controllers.web_controllers import (
    web_login, web_signup, web_signup_verify, web_apply,
    web_get_status, web_get_notifications,
)
from app.controllers.admin_controllers import (
    admin_get_overview, admin_get_all_registrations, admin_get_policies,
    sbp_get_overview, sbp_get_city_breakdown,
    bank_get_card_queue, bank_get_active_cards, bank_issue_card,
    audit_get_all_records, audit_get_stats,
)
from app.models.db import get_db

logger = logging.getLogger(__name__)
web_bp = Blueprint("web", __name__)

# ── SVG Icon registry (Lucide-compatible paths) ───────────────────────────────
_ICON_PATHS: dict[str, str] = {
    "shield-check":  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    "shield":        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    "menu":          '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    "x":             '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    "dashboard":     '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    "network":       '<rect x="9" y="2" width="6" height="6"/><rect x="16" y="16" width="6" height="6"/><rect x="2" y="16" width="6" height="6"/><path d="M12 8v4"/><path d="M12 12H5v4"/><path d="M12 12h7v4"/>',
    "user":          '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    "users":         '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    "logout":        '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    "arrow-left":    '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    "arrow-right":   '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    "check-circle":  '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    "x-circle":      '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    "clock":         '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    "alert":         '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
    "bell":          '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    "card":          '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    "file":          '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    "database":      '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    "cpu":           '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
    "layers":        '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    "send":          '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
    "check":         '<polyline points="20 6 9 17 4 12"/>',
    "chevron-right": '<polyline points="9 18 15 12 9 6"/>',
    "chevron-left":  '<polyline points="15 18 9 12 15 6"/>',
    "chevron-down":  '<polyline points="6 9 12 15 18 9"/>',
    "external":      '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    "blocks":        '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>',
    "eye":           '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    "eye-off":       '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    "refresh":       '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    "home":          '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    "copy":          '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
}


@web_bp.app_template_global("icon")
def render_icon(name: str, cls: str = "w-4 h-4") -> Markup:
    """Render a Lucide SVG icon. Usage: {{ icon('shield-check', 'w-5 h-5 text-emerald-400') }}"""
    path = _ICON_PATHS.get(name, "")
    if not path:
        return Markup("")
    return Markup(
        f'<svg class="{cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
        f'fill="none" stroke="currentColor" stroke-width="2" '
        f'stroke-linecap="round" stroke-linejoin="round">{path}</svg>'
    )


# ── Template context ──────────────────────────────────────────────────────────

def _ctx() -> dict:
    user_role = session.get("role", "")
    return {
        "is_authenticated": bool(session.get("user_id")),
        "username":         session.get("username", ""),
        "role":             user_role,
        "role_home":        ROLE_HOME.get(user_role, "/dashboard"),
        "csrf_token":       get_csrf_token(),
    }


# ── Landing ───────────────────────────────────────────────────────────────────

@web_bp.get("/")
def index():
    return render_template("index.html", **_ctx())


@web_bp.get("/about")
def about_page():
    return render_template("about.html", **_ctx())


# ── Auth ──────────────────────────────────────────────────────────────────────

@web_bp.get("/login")
def login_page():
    if session.get("user_id"):
        role = session.get("role", BENEFICIARY)
        return redirect(ROLE_HOME.get(role, "/dashboard"))
    return render_template(
        "auth/login.html",
        session_expired=bool(request.args.get("session")),
        **_ctx(),
    )


@web_bp.post("/login")
def login_post():
    if not validate_csrf():
        abort(403)
    return web_login()


@web_bp.get("/signup")
def signup_page():
    if session.get("user_id"):
        return redirect("/dashboard")
    return render_template("auth/signup.html", **_ctx())


@web_bp.post("/signup")
def signup_post():
    if not validate_csrf():
        abort(403)
    return web_signup()


@web_bp.post("/signup/verify")
def signup_verify_post():
    """Step 2: Verify OTP and create the account."""
    if not validate_csrf():
        abort(403)
    return web_signup_verify()


@web_bp.post("/logout")
def logout():
    if not validate_csrf():
        abort(403)
    session.clear()
    if request.headers.get("HX-Request"):
        resp = make_response("", 200)
        resp.headers["HX-Redirect"] = "/"
        return resp
    return redirect("/")


# ── Beneficiary Dashboard ─────────────────────────────────────────────────────

@web_bp.get("/dashboard")
@role_required(BENEFICIARY)
def dashboard_home():
    reg = web_get_status()
    return render_template("dashboard/home.html", registration=reg, **_ctx())


@web_bp.get("/dashboard/apply")
@role_required(BENEFICIARY)
def dashboard_apply():
    db = get_db()
    existing = db.registration.find_first(where={"user_id": session["user_id"]})
    if existing:
        return redirect("/dashboard/status")
    return render_template("dashboard/apply.html", **_ctx())


@web_bp.post("/dashboard/apply")
@role_required(BENEFICIARY)
def dashboard_apply_post():
    if not validate_csrf():
        abort(403)
    return web_apply()


@web_bp.get("/dashboard/status")
@role_required(BENEFICIARY)
def dashboard_status():
    reg = web_get_status()
    if not reg:
        return redirect("/dashboard/apply")
    return render_template("dashboard/status.html", registration=reg, **_ctx())


@web_bp.get("/dashboard/notifications")
@role_required(BENEFICIARY)
def dashboard_notifications():
    notes = web_get_notifications()
    return render_template("dashboard/notifications.html", notifications=notes, **_ctx())


@web_bp.get("/dashboard/card")
@role_required(BENEFICIARY)
def dashboard_card():
    reg = web_get_status()
    card = getattr(reg, "card_issue", None) if reg else None
    # Fetch spending history for this card
    transactions = []
    if card:
        db = get_db()
        transactions = db.transactions.find_many(
            where={"card_id": card.card_id},
            order={"timestamp": "desc"},
            take=20,
        )
    return render_template(
        "dashboard/card.html",
        registration=reg,
        card=card,
        transactions=transactions,
        **_ctx(),
    )


@web_bp.post("/dashboard/card/link")
@role_required(BENEFICIARY)
def dashboard_card_link():
    """Step 1 of RFID linking: receive RFID UID from scanner, send OTP to phone."""
    if not validate_csrf():
        abort(403)
    from app.services.otp_service import send_otp
    rfid_uid = request.form.get("rfid_uid", "").strip()
    if not rfid_uid:
        return '<div class="form-error flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">No card detected. Please tap your card on the reader.</div>', 422

    db = get_db()
    user = db.users.find_unique(where={"user_id": session["user_id"]}, include={"registration": True})
    if not user or not user.registration:
        abort(403)

    reg = user.registration[0]
    
    # Check if this RFID isn't already linked to another account
    existing_card = db.card_issue.find_unique(where={"virtual_card_number": rfid_uid})
    if existing_card and existing_card.cnic != reg.cnic:
        return '<div class="form-error flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">This card is already registered to another account.</div>', 409

    # ENSURE CARD RECORD EXISTS (Self-Healing)
    card = db.card_issue.find_unique(where={"cnic": reg.cnic})
    if not card:
        from datetime import datetime, timedelta, timezone
        el = db.eligible.find_unique(where={"cnic": reg.cnic})
        if not el:
             return '<div class="form-error flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">Eligibility record not found. Please wait.</div>', 404
        
        card = db.card_issue.create(data={
            "eligible_id":         el.eligible_id,
            "cnic":                reg.cnic,
            "virtual_card_number": f"P-{uuid.uuid4().hex[:10].upper()}",
            "card_status":         "PENDING_LINK",
            "expiry_date":         datetime.now(timezone.utc) + timedelta(days=365 * 3),
        })

    ok, msg = send_otp(user.phone_number)
    if not ok:
        return f'<div class="form-error flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{msg}</div>', 503

    # Store the scanned RFID UID in session for the verify step
    session["pending_rfid_uid"] = rfid_uid
    masked = user.phone_number[:4] + "****" + user.phone_number[-3:]
    csrf = get_csrf_token()
    return f'''
    <div id="rfid-otp-section" class="space-y-4">
      <div class="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
        <svg class="w-5 h-5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.56 3.42 2 2 0 0 1 3.54 1h3a2 2 0 0 1-2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78A16 16 0 0 0 12 12l.88-.88a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 20 13.34v3z"/>
        </svg>
        <div>
          <p class="text-sm font-semibold text-emerald-400">Card Detected — Dynamic OTP Generated!</p>
          <p class="text-xs text-slate-400">A secure 6-digit verification code has been dispatched to your registered phone number.</p>
          <p class="urdu-text text-xs text-slate-500 mt-0.5">ایک محفوظ 6 ہندسوں کا تصدیقی کوڈ آپ کے رجسٹرڈ موبائل نمبر پر بھیج دیا گیا ہے۔</p>
        </div>
      </div>
      <form hx-post="/dashboard/card/verify-link"
            hx-target="#rfid-otp-section"
            hx-swap="outerHTML"
            class="space-y-4">
        <input type="hidden" name="csrf_token" value="{csrf}" />
        <div>
          <label class="form-label">Enter 6-Digit Verification Code</label>
          <p class="urdu-text text-xs text-slate-500 mb-2">6 ہندسوں کا تصدیقی کوڈ درج کریں</p>
          <input
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
          Verify & Activate Card
        </button>
      </form>
    </div>
    ''', 200


@web_bp.post("/dashboard/card/verify-link")
@role_required(BENEFICIARY)
def dashboard_card_verify_link():
    """Step 2 of RFID linking: verify OTP then save RFID UID to card record."""
    if not validate_csrf():
        abort(403)
    from app.services.otp_service import verify_otp

    rfid_uid = session.get("pending_rfid_uid")
    if not rfid_uid:
        return '<div class="form-error flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">Session expired. Please tap your card again.</div>', 400

    code = request.form.get("otp_code", "").strip()
    if not code or len(code) != 6 or not code.isdigit():
        return '<div class="form-error flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">Please enter a valid 6-digit code.</div>', 422

    db = get_db()
    user = db.users.find_unique(where={"user_id": session["user_id"]})
    ok, msg = verify_otp(user.phone_number, code)
    if not ok:
        return f'<div class="form-error flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">{msg}</div>', 422

    # Find the user's card record and store the RFID UID
    reg = db.registration.find_first(
        where={"user_id": session["user_id"]},
        include={"card_issue": True},
    )
    if not reg or not reg.card_issue:
        return '<div class="form-error flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">No card issued yet. Please wait for approval.</div>', 404

    db.card_issue.update(
        where={"card_id": reg.card_issue.card_id},
        data={"virtual_card_number": rfid_uid, "card_status": "ACTIVE"},
    )
    session.pop("pending_rfid_uid", None)

    # Dispatch bilingual activation notification to update user dashboard immediately
    activated_msg = (
        "مبارک ہو! آپ کا سمارٹ ایڈ کارڈ کامیابی سے ایکٹیویٹ ہو چکا ہے اور اب استعمال کے لیے تیار ہے۔"
    )
    try:
        db.notifications.create(data={
            "cnic":              reg.cnic,
            "message_text_urdu": activated_msg,
            "status":            "SENT",
        })
    except Exception as n_err:
        logger.error("[Web] Failed to create card activation notification: %s", n_err)

    # Initialize the starting ledger balance on the smart contract natively
    try:
        from app.services.blockchain_service import on_chain_issue_card
        on_chain_issue_card(reg.cnic)
    except Exception as err:
        logger.error("[Web] Failed to anchor card issue on blockchain: %s", err)

    resp = make_response("", 200)
    resp.headers["HX-Redirect"] = "/dashboard/card"
    return resp


# ── AidLedger Admin Portal ────────────────────────────────────────────────────

@web_bp.get("/admin")
@role_required(AIDLEDGER_ADMIN)
def admin_dashboard():
    return render_template(
        "admin/dashboard.html",
        overview=admin_get_overview(),
        registrations=admin_get_all_registrations(limit=20),
        policies=admin_get_policies(),
        **_ctx(),
    )


@web_bp.get("/admin/registrations")
@role_required(AIDLEDGER_ADMIN)
def admin_registrations():
    return render_template(
        "admin/dashboard.html",
        overview=admin_get_overview(),
        registrations=admin_get_all_registrations(limit=200),
        policies=admin_get_policies(),
        **_ctx(),
    )


# ── SBP Portal ────────────────────────────────────────────────────────────────

@web_bp.get("/admin/policies")
@role_required(AIDLEDGER_ADMIN)
def admin_policies():
    return render_template(
        "admin/policies.html",
        policies=admin_get_policies(),
        **_ctx(),
    )


@web_bp.get("/admin/network")
@role_required(AIDLEDGER_ADMIN)
def admin_network_page():
    return render_template("admin/network.html", **_ctx())


# ── SBP Portal ────────────────────────────────────────────────────────────

@web_bp.get("/sbp")
@role_required(SBP_ADMIN)
def sbp_dashboard():
    return render_template(
        "sbp/dashboard.html",
        overview=sbp_get_overview(),
        city_breakdown=sbp_get_city_breakdown(),
        **_ctx(),
    )


@web_bp.get("/sbp/city-breakdown")
@role_required(SBP_ADMIN)
def sbp_city_breakdown():
    return render_template(
        "sbp/city_breakdown.html",
        city_breakdown=sbp_get_city_breakdown(),
        **_ctx(),
    )


# ── Bank Portal ───────────────────────────────────────────────────────────────

@web_bp.get("/bank")
@role_required(BANK_ADMIN)
def bank_dashboard():
    return render_template(
        "bank/dashboard.html",
        card_queue=bank_get_card_queue(),
        active_cards=bank_get_active_cards(),
        **_ctx(),
    )


@web_bp.get("/bank/issue")
@role_required(BANK_ADMIN)
def bank_issue_page():
    return render_template(
        "bank/dashboard.html",
        card_queue=bank_get_card_queue(),
        active_cards=bank_get_active_cards(),
        **_ctx(),
    )


@web_bp.get("/bank/active")
@role_required(BANK_ADMIN)
def bank_active_page():
    return render_template(
        "bank/dashboard.html",
        card_queue=bank_get_card_queue(),
        active_cards=bank_get_active_cards(),
        **_ctx(),
    )


@web_bp.post("/bank/issue/<int:eligible_id>")
@role_required(BANK_ADMIN)
def bank_issue(eligible_id: int):
    if not validate_csrf():
        abort(403)
    card_number = "".join(str(uuid.uuid4().int)[:16])
    card, error = bank_issue_card(eligible_id, card_number, bank_reference="")
    if error:
        return Markup(f'<span class="text-xs text-red-400">{error}</span>')
    return Markup(
        '<span class="text-xs text-emerald-400 flex items-center gap-1">'
        + render_icon("check", "w-3 h-3")
        + " Card Issued</span>"
    )


# -- Audit Portal --------------------------------------------------------------

@web_bp.get("/audit")
@role_required(AUDITOR)
def audit_dashboard():
    return render_template(
        "audit/dashboard.html",
        stats=audit_get_stats(),
        records=audit_get_all_records(limit=100),
        **_ctx(),
    )


@web_bp.get("/audit/records")
@role_required(AUDITOR)
def audit_records():
    return render_template(
        "audit/records.html",
        records=audit_get_all_records(limit=500),
        **_ctx(),
    )


@web_bp.get("/audit/network")
@role_required(AUDITOR)
def audit_network_page():
    return render_template("audit/network.html", **_ctx())


# -- Network (redirect to portal-embedded version) ----------------------------

@web_bp.get("/network")
@role_required(AIDLEDGER_ADMIN, AUDITOR)
def network_page():
    """Redirect to each role's own embedded network page."""
    user_role = session.get("role", "")
    if user_role == AIDLEDGER_ADMIN:
        return redirect("/admin/network")
    return redirect("/audit/network")



# ── HTMX Partials ─────────────────────────────────────────────────────────────

@web_bp.get("/htmx/health")
def htmx_health():
    try:
        from app.services.blockchain_service import w3
        bc_ok = w3.is_connected()
    except Exception:
        bc_ok = False

    if bc_ok:
        return Markup(
            '<div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium '
            'border bg-emerald-500/10 border-emerald-500/25 text-emerald-400">'
            '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>'
            "System: Online</div>"
        )
    return Markup(
        '<div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium '
        'border bg-slate-800 border-slate-700 text-slate-500">'
        '<span class="w-1.5 h-1.5 rounded-full bg-slate-600"></span>'
        "System: Connecting...</div>"
    )


@web_bp.get("/htmx/pipeline-status")
@role_required(BENEFICIARY)
def htmx_pipeline_status():
    """Returns updated pipeline tracker fragment for live polling."""
    reg = web_get_status()
    if not reg:
        return Markup('<p class="text-slate-500 text-sm">No application found.</p>')
    return render_template("partials/pipeline_tracker.html", registration=reg)


@web_bp.get("/htmx/network-stats")
@role_required(AIDLEDGER_ADMIN, AUDITOR)
def htmx_network_stats():
    try:
        from app.services.blockchain_service import w3
        block = w3.eth.block_number
        peers = w3.net.peer_count
        chain = w3.eth.chain_id
        connected = True
    except Exception:
        block, peers, chain, connected = 0, 0, 1337, False

    if not connected:
        return Markup('<p class="text-slate-500 text-sm">Node unreachable — start the Besu network.</p>')

    return Markup(f"""
    <div class="grid grid-cols-3 gap-4 text-center">
      <div><div class="text-2xl font-bold text-emerald-400">#{block}</div>
           <div class="text-xs text-slate-500 mt-1">Latest Block</div></div>
      <div><div class="text-2xl font-bold text-blue-400">{peers}</div>
           <div class="text-xs text-slate-500 mt-1">Peers</div></div>
      <div><div class="text-2xl font-bold text-amber-400">{chain}</div>
           <div class="text-xs text-slate-500 mt-1">Chain ID</div></div>
    </div>""")


# ── Error handlers ────────────────────────────────────────────────────────────

@web_bp.app_errorhandler(403)
def forbidden(e):
    if request.path.startswith("/api/"):
        return jsonify({"message": "Forbidden."}), 403
    return render_template("errors/403.html", **_ctx()), 403


@web_bp.app_errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        return jsonify({"message": "Not found."}), 404
    return render_template("errors/404.html", **_ctx()), 404
