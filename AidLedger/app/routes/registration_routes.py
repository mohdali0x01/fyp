"""
Registration Routes Blueprint.

Endpoints:
    POST /api/registration/apply   — Submit aid application (JWT required)
    GET  /api/registration/status  — Get pipeline status (JWT required)

All routes are protected by the JWT authentication decorator.
"""
from flask import Blueprint
from app.middleware.auth_middleware import authenticate
from app.controllers.registration_controller import apply_for_aid, get_status

registration_bp = Blueprint("registration", __name__)


@registration_bp.post("/apply")
@authenticate
def apply_route():
    return apply_for_aid()


@registration_bp.get("/status")
@authenticate
def status_route():
    return get_status()
