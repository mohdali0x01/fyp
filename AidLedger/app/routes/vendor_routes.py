"""
Vendor Routes Blueprint — RFID + OTP payment platform for authorized vendors.
All routes are scoped under /vendor/* and run on port 5001.
"""
from flask import Blueprint, redirect, session
from app.middleware.session_auth import login_required, role_required, VENDOR
from app.controllers.vendor_controllers import (
    vendor_login_page,
    vendor_login_post,
    vendor_logout,
    vendor_dashboard,
    vendor_scan_card,
    vendor_verify_otp,
)

vendor_bp = Blueprint("vendor", __name__, url_prefix="/vendor")


# ── Public routes ─────────────────────────────────────────────────────────────

@vendor_bp.get("/login")
def login_page():
    return vendor_login_page()


@vendor_bp.post("/login")
def login_post():
    return vendor_login_post()


@vendor_bp.post("/logout")
@login_required
def logout():
    return vendor_logout()


# Root redirect
@vendor_bp.get("/")
def root():
    if session.get("role") == "VENDOR":
        return redirect("/vendor/dashboard")
    return redirect("/vendor/login")


# ── Protected vendor routes (VENDOR role required) ────────────────────────────

@vendor_bp.get("/dashboard")
@role_required(VENDOR)
def dashboard():
    return vendor_dashboard()


@vendor_bp.post("/scan-card")
@role_required(VENDOR)
def scan_card():
    return vendor_scan_card()


@vendor_bp.post("/verify-otp")
@role_required(VENDOR)
def verify_otp_route():
    return vendor_verify_otp()
