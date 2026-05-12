"""
AidLedger Flask Backend — Entry Point
Run in WSL Ubuntu:
    source venv/bin/activate
    python run.py
"""
import os
from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "development") == "development"
    # Threaded=True allows handling concurrent requests (one per thread)
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
