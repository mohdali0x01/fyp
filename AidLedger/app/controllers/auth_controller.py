"""
Auth Controller — Signup and Login request handlers.

Security:
- bcrypt (12 rounds) for password hashing
- Constant-time bcrypt.checkpw even when user not found (prevents timing attacks)
- Identical error messages for duplicate username/phone (prevents enumeration)
- Password hash is NEVER returned in any response
"""
import logging
import bcrypt
from flask import request, jsonify
from pydantic import BaseModel, field_validator, model_validator
import re

from app.models.db import get_db
from app.utils.jwt_utils import sign_token

logger = logging.getLogger(__name__)

SALT_ROUNDS = 12  # bcrypt cost factor — 12 rounds for strong security

# ── Pydantic Validators (equivalent to Zod schemas) ───────────────────────────

class SignupInput(BaseModel):
    username:        str
    phone_number:    str
    password:        str
    confirmPassword: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
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
        if not re.match(r"^(\+92|0)[0-9]{10}$", v):
            raise ValueError("Phone number must be a valid Pakistani number (e.g. 03001234567)")
        return v

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
    def passwords_match(self) -> "SignupInput":
        if self.password != self.confirmPassword:
            raise ValueError("Passwords do not match")
        return self


class LoginInput(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        if not v:
            raise ValueError("Username is required")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v:
            raise ValueError("Password is required")
        return v


# ── SIGNUP ────────────────────────────────────────────────────────────────────

def signup():
    """
    POST /api/auth/signup
    Creates a new BENEFICIARY account.
    Returns a JWT immediately after creation so the user is logged in.
    """
    # Validate input
    try:
        body = SignupInput.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        errors = [
            {"field": err["loc"][-1] if err.get("loc") else "unknown", "message": err["msg"]}
            for err in (e.errors() if hasattr(e, "errors") else [{"loc": [], "msg": str(e)}])
        ]
        return jsonify({"message": "Validation failed.", "errors": errors}), 422

    db = get_db()

    # Hash password before any DB operation
    password_hash = bcrypt.hashpw(
        body.password.encode("utf-8"),
        bcrypt.gensalt(rounds=SALT_ROUNDS)
    ).decode("utf-8")

    try:
        new_user = db.users.create(data={
            "username":      body.username,
            "phone_number":  body.phone_number,
            "password_hash": password_hash,
            "role":          "BENEFICIARY",
        })
    except Exception as err:
        err_str = str(err)
        # Handle unique constraint violations (duplicate username or phone)
        if "Unique constraint" in err_str or "unique" in err_str.lower():
            # Deliberately vague — prevents user enumeration
            return jsonify({"message": "An account with these credentials already exists."}), 409
        logger.error("[Auth] Signup DB error: %s", err)
        return jsonify({"message": "An internal server error occurred."}), 500

    token = sign_token(new_user.user_id, new_user.username, new_user.role)
    return jsonify({
        "message": "Account created successfully.",
        "token":   token,
        "user": {
            "user_id":  new_user.user_id,
            "username": new_user.username,
            "role":     new_user.role,
        },
    }), 201


# ── LOGIN ─────────────────────────────────────────────────────────────────────

# Dummy hash for constant-time comparison when user is not found
_DUMMY_HASH = bcrypt.hashpw(b"dummy_password_for_timing", bcrypt.gensalt(rounds=12))

def login():
    """
    POST /api/auth/login
    Authenticates a user and returns a JWT.

    Security: bcrypt comparison runs even when user is not found (constant-time).
    """
    try:
        body = LoginInput.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        errors = [
            {"field": err["loc"][-1] if err.get("loc") else "unknown", "message": err["msg"]}
            for err in (e.errors() if hasattr(e, "errors") else [{"loc": [], "msg": str(e)}])
        ]
        return jsonify({"message": "Validation failed.", "errors": errors}), 422

    db = get_db()
    user = db.users.find_unique(where={"username": body.username})

    # Always run bcrypt — prevents timing attacks by ensuring constant work
    stored_hash = user.password_hash.encode("utf-8") if user else _DUMMY_HASH
    password_match = bcrypt.checkpw(body.password.encode("utf-8"), stored_hash)

    if not user or not password_match:
        return jsonify({"message": "Invalid username or password."}), 401

    token = sign_token(user.user_id, user.username, user.role)
    return jsonify({
        "message": "Login successful.",
        "token":   token,
        "user": {
            "user_id":  user.user_id,
            "username": user.username,
            "role":     user.role,
        },
    }), 200
