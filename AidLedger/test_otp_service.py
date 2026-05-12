import sys
import os
import logging
logging.basicConfig(level=logging.DEBUG)

# Point to local workspace dir
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.services.otp_service import send_otp, verify_otp, _active_otps

print("Testing Local Real-Time Mock OTP Generation...")
try:
    phone = "03025939238"
    ok, msg = send_otp(phone)
    print(f"Send Result: ok={ok}, msg={msg}")
    
    # Read back from LATEST_OTP.txt to demonstrate presentation behavior
    otp_file = os.path.join(os.path.abspath(os.path.dirname(__file__)), "LATEST_OTP.txt")
    if os.path.exists(otp_file):
        print("\n--- Contents of LATEST_OTP.txt ---")
        with open(otp_file, "r", encoding="utf-8") as f:
            print(f.read())
        print("----------------------------------\n")
        
    # Test Verification
    stored_code = list(_active_otps.values())[0] if _active_otps else "123456"
    print(f"Attempting verification with correct code: {stored_code}")
    v_ok, v_msg = verify_otp(phone, stored_code)
    print(f"Verify Result: ok={v_ok}, msg={v_msg}")
    
except Exception as e:
    print(f"Error: {e}")
