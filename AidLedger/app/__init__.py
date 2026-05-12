"""
AidLedger Flask Application Factory.

This module creates and configures the Flask app with all security
middleware, rate limiting, CORS, and registered blueprints.
"""
import os
import logging
from uuid import uuid4
from flask import Flask, request, g, jsonify, render_template, session
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_talisman import Talisman
from dotenv import load_dotenv

# Load environment variables before anything else
load_dotenv()

# ── Startup Validation ────────────────────────────────────────────────────────
_JWT_SECRET = os.getenv("JWT_SECRET", "")
if not _JWT_SECRET:
    raise RuntimeError("FATAL: JWT_SECRET environment variable is not set.")
if len(_JWT_SECRET) < 32:
    raise RuntimeError(
        "FATAL: JWT_SECRET is too short. Minimum 32 characters required for HS256 security."
    )

_PRIV_KEY = os.getenv("AIDLEDGER_PRIVATE_KEY", "")
if not _PRIV_KEY:
    raise RuntimeError("FATAL: AIDLEDGER_PRIVATE_KEY is not set.")

# Warn operators if a known test key is used in production
_KNOWN_TEST_KEY = "0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63"
if os.getenv("FLASK_ENV") == "production" and _PRIV_KEY == _KNOWN_TEST_KEY:
    raise RuntimeError(
        "FATAL: Production is using the default test private key. "
        "Set a secure AIDLEDGER_PRIVATE_KEY in your production environment."
    )

# ── Configure Logging ─────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if os.getenv("FLASK_ENV") == "development" else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


def create_app() -> Flask:
    """
    Flask application factory.
    Creates and returns a fully configured Flask app instance.
    """
    app = Flask(__name__)

    # ── Trust Proxy (for rate limiting behind nginx/docker) ───────────────────
    app.config["RATELIMIT_HEADERS_ENABLED"] = True

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Flask now serves both HTML and API — CORS only needed for API routes
    # if accessed from external clients in the future.
    CORS(
        app,
        origins=[os.getenv("FRONTEND_URL", "http://localhost:5000")],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
        supports_credentials=True,
    )

    # ── Security Headers (Talisman = Python Helmet) ───────────────────────────
    # For a pure API server (no HTML), disable CSP, enable HSTS.
    Talisman(
        app,
        content_security_policy=False,     # API-only — no HTML served
        force_https=False,                 # Dev environment — no HTTPS
        referrer_policy="no-referrer",
        x_content_type_options=True,
        x_xss_protection=True,
    )

    # ── Flask Session ─────────────────────────────────────────────────────────
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-in-prod")
    app.config["SESSION_COOKIE_HTTPONLY"]  = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"]   = False  # True in production with HTTPS
    app.config["PERMANENT_SESSION_LIFETIME"] = 3600  # 1 hour

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    limiter = Limiter(
        key_func=get_remote_address,
        app=app,
        default_limits=["100 per 15 minutes"],
        storage_uri="memory://",
    )
    # Store limiter on app so blueprints can access it
    app.limiter = limiter  # type: ignore[attr-defined]

    # ── Request Correlation ID ────────────────────────────────────────────────
    # Attach a unique X-Request-ID to every request for audit trail correlation.
    @app.before_request
    def attach_request_id():
        g.request_id = request.headers.get("X-Request-ID", str(uuid4()))

    @app.after_request
    def add_request_id_header(response):
        response.headers["X-Request-ID"] = getattr(g, "request_id", "")
        return response

    # ── Request Logging ───────────────────────────────────────────────────────
    @app.after_request
    def log_request(response):
        if os.getenv("FLASK_ENV") != "test":
            logger.info(
                "%s %s %s [RID: %s]",
                request.method,
                request.path,
                response.status_code,
                getattr(g, "request_id", "-"),
            )
        return response

    # ── Health Check ──────────────────────────────────────────────────────────
    @app.get("/api/health")
    def health():
        return jsonify({"status": "OK", "service": "AidLedger API"}), 200

    # ── Register Blueprints ───────────────────────────────────────────────────
    from app.routes.auth_routes import auth_bp
    from app.routes.registration_routes import registration_bp
    from app.routes.web_routes import web_bp

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(registration_bp, url_prefix="/api/registration")
    app.register_blueprint(web_bp)  # no prefix — serves HTML at /

    # Apply stricter auth rate limit (10/15min) to all auth endpoints
    # This is the Flask-Limiter v4 correct approach for Blueprint-level limits
    AUTH_LIMIT = "10 per 15 minutes"
    for endpoint in ["auth.signup_route", "auth.login_route"]:
        limiter.limit(
            AUTH_LIMIT,
            error_message="Too many authentication attempts. Please try again in 15 minutes."
        )(app.view_functions[endpoint])

    # ── 404 Handler ───────────────────────────────────────────────────────────
    @app.errorhandler(404)
    def not_found(_e):
        if request.path.startswith("/api/"):
            return jsonify({"message": "Resource not found."}), 404
        return render_template("errors/404.html",
                               is_authenticated=bool(session.get("user_id")),
                               username=session.get("username", ""),
                               csrf_token=""), 404

    # ── 405 Handler ───────────────────────────────────────────────────────────
    @app.errorhandler(405)
    def method_not_allowed(_e):
        return jsonify({"message": "Method not allowed."}), 405

    # ── Global Error Handler ──────────────────────────────────────────────────
    @app.errorhandler(Exception)
    def handle_exception(err):
        is_dev = os.getenv("FLASK_ENV") == "development"
        logger.error("[ERROR] %s %s: %s", request.method, request.path, err, exc_info=True)
        body = {"message": "An internal server error occurred."}
        if is_dev:
            body["error"] = str(err)
        return jsonify(body), 500

    # ── Startup: Connect Database + Blockchain ────────────────────────────────
    from app.models.db import connect_db
    from app.services.blockchain_service import verify_blockchain_connection

    with app.app_context():
        connect_db()
        verify_blockchain_connection()

    logger.info("🚀 AidLedger Flask Backend started on port %s", os.getenv("PORT", 5000))
    return app
