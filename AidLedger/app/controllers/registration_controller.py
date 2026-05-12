"""
Registration Controller — Aid application and status endpoints.

Security:
- Route protected by JWT authentication middleware.
- CNIC normalized (dashes stripped) before storage and lookup.
- Duplicate application check per user AND per CNIC.
- Pipeline runs synchronously in same request (fully automated).
"""
import logging
import re
from flask import request, jsonify, g
from pydantic import BaseModel, field_validator

from app.models.db import get_db
from app.services.blockchain_service import on_chain_log_application
from app.services.verification_service import run_verification_pipeline

logger = logging.getLogger(__name__)


# ── Pydantic Validator ────────────────────────────────────────────────────────

class RegistrationInput(BaseModel):
    full_name: str
    cnic:      str
    address:   str
    city:      str

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
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
        if not re.match(r"^([0-9]{13}|[0-9]{5}-[0-9]{7}-[0-9]{1})$", v):
            raise ValueError("CNIC must be 13 digits or in format: XXXXX-XXXXXXX-X")
        return v

    @field_validator("address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        if len(v) < 10:
            raise ValueError("Address must be at least 10 characters")
        if len(v) > 500:
            raise ValueError("Address must be at most 500 characters")
        return v

    @field_validator("city")
    @classmethod
    def validate_city(cls, v: str) -> str:
        if len(v) < 2:
            raise ValueError("City must be at least 2 characters")
        if len(v) > 100:
            raise ValueError("City must be at most 100 characters")
        return v


# ── APPLY FOR AID ─────────────────────────────────────────────────────────────

def apply_for_aid():
    """
    POST /api/registration/apply
    Submits the beneficiary's aid application and runs the full verification pipeline.

    Security:
    - JWT required (authenticate decorator applied in route).
    - CNIC normalized to prevent format-bypass attacks.
    - One application per user, one per CNIC.
    """
    try:
        body = RegistrationInput.model_validate(request.get_json(force=True) or {})
    except Exception as e:
        errors = [
            {"field": err["loc"][-1] if err.get("loc") else "unknown", "message": err["msg"]}
            for err in (e.errors() if hasattr(e, "errors") else [{"loc": [], "msg": str(e)}])
        ]
        return jsonify({"message": "Validation failed.", "errors": errors}), 422

    user_id = g.current_user["userId"]
    db = get_db()

    # Normalize CNIC — strip dashes to match kyc_master storage format
    # Security: prevents duplicate bypass using different CNIC formats
    normalized_cnic = body.cnic.replace("-", "").strip()

    # Prevent duplicate application from same user
    existing_by_user = db.registration.find_first(where={"user_id": user_id})
    if existing_by_user:
        return jsonify({
            "message":        "You have already submitted an application.",
            "current_status": existing_by_user.pipeline_status,
        }), 409

    # Prevent duplicate CNIC from different accounts
    existing_by_cnic = db.registration.find_unique(where={"cnic": normalized_cnic})
    if existing_by_cnic:
        return jsonify({"message": "An application with this CNIC already exists."}), 409

    # Create the registration record
    registration = db.registration.create(data={
        "user_id":         user_id,
        "cnic":            normalized_cnic,
        "full_name":       body.full_name,
        "address":         body.address,
        "city":            body.city,
        "pipeline_status": "PENDING",
    })

    # Anchor application start on blockchain (non-fatal)
    try:
        on_chain_log_application(normalized_cnic)
    except Exception as err:
        logger.error("[Blockchain] logApplication FAILED (non-fatal): %s", err)

    # Run the full automated verification pipeline
    result = run_verification_pipeline(normalized_cnic, registration.registration_id)

    return jsonify({
        "message":          "Application submitted and verification completed.",
        "registration_id":  registration.registration_id,
        "verification":     result,
    }), 201


# ── GET STATUS ────────────────────────────────────────────────────────────────

def get_status():
    """
    GET /api/registration/status
    Returns the current pipeline status and latest Urdu notification
    for the logged-in beneficiary.
    """
    user_id = g.current_user["userId"]
    db = get_db()

    registration = db.registration.find_first(
        where={"user_id": user_id},
        include={
            "notifications": {
                "order_by": {"created_at": "desc"},
                "take":     1,
            }
        },
    )

    if not registration:
        return jsonify({"message": "No application found for this account."}), 404

    # Build a clean serializable response
    notifications = []
    if registration.notifications:
        for n in registration.notifications:
            notifications.append({
                "message_text_urdu": n.message_text_urdu,
                "created_at":        n.created_at.isoformat() if n.created_at else None,
            })

    return jsonify({
        "message": "Application status retrieved.",
        "application": {
            "registration_id": registration.registration_id,
            "cnic":            registration.cnic,
            "full_name":       registration.full_name,
            "city":            registration.city,
            "pipeline_status": registration.pipeline_status,
            "created_at":      registration.created_at.isoformat() if registration.created_at else None,
            "notifications":   notifications,
        },
    }), 200
