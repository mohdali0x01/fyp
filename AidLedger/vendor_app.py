"""
AidLedger Vendor Platform — Separate Flask App (Port 5001).

This is a standalone Flask application for the Vendor Portal.
It shares the same database, blockchain service, and session config
as the main AidLedger app, but runs on a different port for isolation.

Run in WSL Ubuntu:
    source venv/bin/activate
    python run_vendor.py
"""
import os
import logging
from uuid import uuid4
from flask import Flask, request, g, jsonify, render_template, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from markupsafe import Markup
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.DEBUG if os.getenv("FLASK_ENV") == "development" else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── SVG Icon registry (Shared with main app) ──────────────────────────────────
_ICON_PATHS: dict[str, str] = {
    "shield-check":  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>',
    "logout":        '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    "card":          '<rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
    "refresh":       '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
}


def create_vendor_app() -> Flask:
    """
    Creates the standalone Vendor Flask application.
    Shares DB + blockchain config with the main app via environment variables.
    """
    # Force the root path to be the project root
    root_path = os.path.dirname(os.path.abspath(__file__))
    
    app = Flask(
        __name__,
        root_path=root_path,
        template_folder="app/templates",
        static_folder="app/static",
        static_url_path="/static"
    )


    # ── Session config (same secret = sessions are cross-app aware) ──────────
    app.config["SECRET_KEY"]                = os.getenv("SECRET_KEY", "dev-secret-change-in-prod")
    app.config["SESSION_COOKIE_HTTPONLY"]   = True
    app.config["SESSION_COOKIE_SAMESITE"]  = "Lax"
    app.config["SESSION_COOKIE_SECURE"]    = False  # True in production with HTTPS
    app.config["SESSION_COOKIE_NAME"]      = "vendor_session"  # Separate cookie from main app
    app.config["PERMANENT_SESSION_LIFETIME"] = 3600  # 1 hour

    # ── CORS ─────────────────────────────────────────────────────────────────
    CORS(
        app,
        origins=[os.getenv("VENDOR_FRONTEND_URL", "http://localhost:5001")],
        supports_credentials=True,
    )

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=["200 per 15 minutes"],
        storage_uri="memory://",
    )
    app.limiter = limiter  # type: ignore[attr-defined]

    # Strict limit on login endpoint to prevent brute force
    @app.before_request
    def attach_request_id():
        g.request_id = request.headers.get("X-Request-ID", str(uuid4()))

    @app.after_request
    def add_request_id_header(response):
        response.headers["X-Request-ID"] = getattr(g, "request_id", "")
        return response

    # ── Template Globals ──────────────────────────────────────────────────────
    @app.template_global("icon")
    def render_icon(name: str, cls: str = "w-4 h-4") -> Markup:
        path = _ICON_PATHS.get(name, "")
        if not path: return Markup("")
        return Markup(
            f'<svg class="{cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" '
            f'fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round">{path}</svg>'
        )

    @app.template_filter("pkt_time")
    def pkt_time_filter(dt, fmt="%I:%M %p"):
        if not dt:
            return "—"
        from datetime import datetime, timedelta, timezone
        if isinstance(dt, str):
            try:
                dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
            except Exception:
                return dt
        if not isinstance(dt, datetime):
            return str(dt)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        pkt_tz = timezone(timedelta(hours=5))
        return dt.astimezone(pkt_tz).strftime(fmt)

    # ── Register Vendor Blueprint ─────────────────────────────────────────────
    from app.routes.vendor_routes import vendor_bp
    app.register_blueprint(vendor_bp)

    # Apply strict rate limit on vendor login (5 attempts per 15 min)
    limiter.limit(
        "5 per 15 minutes",
        error_message="Too many login attempts. Please wait 15 minutes."
    )(app.view_functions["vendor.login_post"])

    # ── Root redirect ─────────────────────────────────────────────────────────
    @app.get("/")
    def root():
        from flask import redirect
        return redirect("/vendor/login")

    # ── 404 Handler ───────────────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(_e):
        return render_template(
            "vendor/login.html",
            csrf_token="",
            error="Page not found.",
        ), 404

    # ── Global Error Handler ──────────────────────────────────────────────────
    @app.errorhandler(Exception)
    def handle_exception(err):
        logger.error("[Vendor Error] %s %s: %s", request.method, request.path, err, exc_info=True)
        is_dev = os.getenv("FLASK_ENV") == "development"
        body = {"message": "An internal server error occurred."}
        if is_dev:
            body["error"] = str(err)
        return jsonify(body), 500

    # ── Startup: Connect DB + Blockchain ──────────────────────────────────────
    from app.models.db import connect_db
    from app.services.blockchain_service import verify_blockchain_connection

    with app.app_context():
        connect_db()
        verify_blockchain_connection()

    logger.info("🏪 Vendor App Paths: Static=%s, Templates=%s", app.static_folder, app.template_folder)
    logger.info("🏪 AidLedger Vendor Platform started on port %s", os.getenv("VENDOR_PORT", 5001))
    return app
