"""
AidLedger Vendor Platform — Entry Point (Port 5001)

Run in WSL Ubuntu:
    source venv/bin/activate
    python run_vendor.py
"""
import os
from vendor_app import create_vendor_app

app = create_vendor_app()

if __name__ == "__main__":
    port = int(os.getenv("VENDOR_PORT", 5001))
    debug = os.getenv("FLASK_ENV", "development") == "development"
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
