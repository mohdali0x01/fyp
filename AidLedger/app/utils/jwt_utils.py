"""
JWT Utilities — Token signing and verification.

Security:
- Algorithm: HS256 (HMAC-SHA256)
- Secret: Loaded from environment (min 32 chars enforced in app factory)
- Expiry: Configurable via JWT_EXPIRES_IN (default 3600 seconds = 1 hour)
- Never exposes token errors to clients — just returns None on failure
"""
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
import jwt

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
JWT_SECRET: str = os.getenv("JWT_SECRET", "")
JWT_EXPIRES_IN: int = int(os.getenv("JWT_EXPIRES_IN", "3600"))  # seconds
ALGORITHM = "HS256"


def sign_token(user_id: int, username: str, role: str) -> str:
    """
    Creates a signed JWT containing user identity.

    Payload:
        userId   — database user_id (int)
        username — unique username (str)
        role     — user role e.g. BENEFICIARY (str)
        iat      — issued at timestamp
        exp      — expiry timestamp
    """
    now = datetime.now(tz=timezone.utc)
    payload = {
        "userId": user_id,
        "username": username,
        "role": role,
        "iat": now,
        "exp": now + timedelta(seconds=JWT_EXPIRES_IN),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def verify_token(token: str) -> Optional[dict]:
    """
    Verifies a JWT token and returns the decoded payload.

    Returns:
        dict with userId, username, role — or None if invalid/expired.

    Security:
        Never exposes specific JWT error details (prevents information leakage).
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("Token verification failed: expired token.")
        return None
    except jwt.InvalidTokenError:
        logger.debug("Token verification failed: invalid token.")
        return None
