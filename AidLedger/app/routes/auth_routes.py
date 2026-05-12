"""
Auth Routes Blueprint.

Endpoints:
    POST /api/auth/signup  — Create a new BENEFICIARY account
    POST /api/auth/login   — Authenticate and receive a JWT

Rate limiting:
    10 attempts per 15 minutes (auth-specific, stricter than the global 100/15min)
    Applied via the app-level Limiter using @limiter.limit() on each route.
"""
from flask import Blueprint, current_app
from app.controllers.auth_controller import signup, login

auth_bp = Blueprint("auth", __name__)

AUTH_RATE_LIMIT = "10 per 15 minutes"
AUTH_LIMIT_MSG  = "Too many authentication attempts. Please try again in 15 minutes."


@auth_bp.post("/signup")
def signup_route():
    # Rate limit applied in app factory via limiter.limit() on blueprint
    return signup()


@auth_bp.post("/login")
def login_route():
    return login()
