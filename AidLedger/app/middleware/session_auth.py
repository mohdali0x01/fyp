"""Session-based authentication decorator for web (HTML) routes."""
import logging
from functools import wraps
from flask import session, redirect, request, make_response, g, render_template

logger = logging.getLogger(__name__)

# Role constants
BENEFICIARY    = "BENEFICIARY"
AIDLEDGER_ADMIN = "AIDLEDGER_ADMIN"
SBP_ADMIN      = "SBP_ADMIN"
BANK_ADMIN     = "BANK_ADMIN"
AUDITOR        = "AUDITOR"
VENDOR         = "VENDOR"

# Mapping: role → home URL after login
ROLE_HOME = {
    BENEFICIARY:     "/dashboard",
    AIDLEDGER_ADMIN: "/admin",
    SBP_ADMIN:       "/sbp",
    BANK_ADMIN:      "/bank",
    AUDITOR:         "/audit",
    VENDOR:          "/vendor/dashboard",
}


def login_required(f):
    """
    Requires an active Flask session.
    For HTMX requests: returns HX-Redirect instead of HTTP 302.
    Sets g.current_user so shared business logic can use it.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("user_id"):
            if request.headers.get("HX-Request"):
                resp = make_response("", 204)
                resp.headers["HX-Redirect"] = "/login"
                return resp
            return redirect("/login")
        g.current_user = {
            "userId":   session["user_id"],
            "username": session["username"],
            "role":     session["role"],
        }
        return f(*args, **kwargs)
    return decorated


def role_required(*allowed_roles):
    """
    Requires login AND a specific role.
    Usage: @role_required('AIDLEDGER_ADMIN', 'AUDITOR')
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not session.get("user_id"):
                if request.headers.get("HX-Request"):
                    resp = make_response("", 204)
                    resp.headers["HX-Redirect"] = "/login"
                    return resp
                return redirect("/login")
            user_role = session.get("role", "")
            g.current_user = {
                "userId":   session["user_id"],
                "username": session["username"],
                "role":     user_role,
            }
            if user_role not in allowed_roles:
                from app.utils.csrf import get_csrf_token
                return render_template(
                    "errors/403.html",
                    is_authenticated=True,
                    username=session.get("username", ""),
                    role=user_role,
                    csrf_token=get_csrf_token(),
                ), 403
            return f(*args, **kwargs)
        return decorated
    return decorator

