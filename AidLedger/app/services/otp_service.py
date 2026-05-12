"""
OTP Verification Service — AidLedger
Completely offline, file-based mock OTP service tailored for end-to-end demonstrations.
Generates dynamic random 6-digit verification codes in real-time and instantly saves them
to a local text file (LATEST_OTP.txt) in the project root folder for live presentation reading.
Tracks active codes securely in server memory.
"""
import os
import random
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# In-memory dictionary mapping normalized phone numbers to their active dynamically generated OTPs
_active_otps: dict[str, str] = {}

# Path to the visual output text file stored in the workspace root
_OTP_FILE_PATH = os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "LATEST_OTP.txt")


def _to_e164(phone: str) -> str:
    """Normalize Pakistani phone numbers consistently to E.164 format for key matching."""
    p = phone.strip().replace(" ", "").replace("-", "")
    if p.startswith("+"):
        return p
    if p.startswith("0"):
        return "+92" + p[1:]
    if p.startswith("92"):
        return "+" + p
    return "+" + p


def send_otp(phone_number: str) -> tuple[bool, str]:
    """
    Generates a dynamic random 6-digit verification code, saves it to LATEST_OTP.txt,
    and stores it securely in server memory for instant drop-in matching.
    """
    e164 = _to_e164(phone_number)
    
    # Generate dynamic random 6-digit OTP
    otp_code = str(random.randint(100000, 999999))
    _active_otps[e164] = otp_code
    
    timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Format the file content beautifully for demonstration reading
    content = f"""=== AIDLEDGER LIVE VERIFICATION ===
Phone Number: {e164}
Verification Code: {otp_code}
Generated At: {timestamp_str}
===================================
"""
    try:
        with open(_OTP_FILE_PATH, "w", encoding="utf-8") as f:
            f.write(content)
        logger.info("[OTPService] Dynamic OTP %s generated for %s and saved to %s", otp_code, e164, _OTP_FILE_PATH)
    except Exception as err:
        logger.error("[OTPService] Failed to write OTP file to %s: %s", _OTP_FILE_PATH, err)
        # Fallback to current dir if root is inaccessible
        fallback_path = os.path.join(os.path.dirname(__file__), "LATEST_OTP.txt")
        with open(fallback_path, "w", encoding="utf-8") as f:
            f.write(content)
            
    return True, "OTP sent successfully"


def verify_otp(phone_number: str, code: str) -> tuple[bool, str]:
    """
    Verifies the submitted code against the dynamically generated code stored in server memory.
    Supports matching instantly without database queries.
    """
    e164 = _to_e164(phone_number)
    code = code.strip()
    
    stored_code = _active_otps.get(e164)
    
    if not stored_code:
        logger.warning("[OTPService] Verification failed: No active OTP found in memory for %s", e164)
        return False, "OTP expired or not sent. Please request a new code."
        
    if code == stored_code:
        logger.info("[OTPService] Successful OTP match for %s", e164)
        # Clear the OTP after successful use to prevent replay
        _active_otps.pop(e164, None)
        return True, "OTP verified successfully"
        
    logger.warning("[OTPService] Incorrect OTP submitted for %s. Expected %s, got %s", e164, stored_code, code)
    return False, "Invalid verification code. Please try again."
