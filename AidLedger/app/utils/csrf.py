"""CSRF protection — token generation and validation for web forms."""
import os
import hmac
from flask import session, request


def get_csrf_token() -> str:
    if "csrf_token" not in session:
        session["csrf_token"] = os.urandom(32).hex()
    return session["csrf_token"]


def validate_csrf() -> bool:
    session_token = session.get("csrf_token", "")
    if not session_token:
        return False
    request_token = (
        request.headers.get("X-CSRF-Token")
        or request.form.get("csrf_token", "")
    )
    if not request_token:
        return False
    return hmac.compare_digest(session_token, request_token)
