"""
JWT Authentication Middleware — Flask decorator.

Protects routes by requiring a valid Bearer JWT in the Authorization header.
Stores the decoded payload in Flask's `g` object for use in route handlers.

Security:
- Generic 401 message regardless of failure reason (prevents enumeration)
- Token payload accessible via g.current_user
"""
import logging
from functools import wraps
from flask import request, jsonify, g
from app.utils.jwt_utils import verify_token

logger = logging.getLogger(__name__)


def authenticate(f):
    """
    Decorator that enforces JWT authentication on a route.

    Usage:
        @registration_bp.post("/apply")
        @authenticate
        def apply_for_aid():
            user = g.current_user  # {'userId': ..., 'username': ..., 'role': ...}
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({"message": "Unauthorized: No token provided."}), 401

        token = auth_header.split(" ", 1)[1]
        payload = verify_token(token)

        if payload is None:
            # Do NOT reveal whether the token is expired or malformed
            return jsonify({"message": "Unauthorized: Invalid or expired token."}), 401

        # Attach decoded user to Flask's request context
        g.current_user = payload
        return f(*args, **kwargs)

    return decorated
