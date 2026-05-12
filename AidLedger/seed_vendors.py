"""
Seed Vendor Accounts — AidLedger Vendor Platform

Creates pre-approved vendor accounts in the database.
Vendors cannot self-register — only accounts created via this script
(or by an admin) can access the Vendor Portal.

Run in WSL Ubuntu:
    source venv/bin/activate
    python seed_vendors.py

Default credentials for testing:
    Username: ahmed_grocery   Password: Vendor@1234
    Username: fatima_store    Password: Vendor@1234
"""
import os
import sys
import bcrypt
from dotenv import load_dotenv

load_dotenv()

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.db import connect_db, get_db

SALT_ROUNDS = 12

VENDORS = [
    {
        "username":     "ahmed_grocery",
        "phone_number": "+923001111001",
        "password":     "Vendor@1234",
        "display":      "Ahmed's Grocery Store — Karachi",
    },
    {
        "username":     "fatima_store",
        "phone_number": "+923001111002",
        "password":     "Vendor@1234",
        "display":      "Fatima General Store — Lahore",
    },
]


def main():
    connect_db()
    db = get_db()

    created = 0
    skipped = 0

    for v in VENDORS:
        existing = db.users.find_unique(where={"username": v["username"]})
        if existing:
            print(f"[SKIP] Vendor already exists: {v['username']}")
            skipped += 1
            continue

        pw_hash = bcrypt.hashpw(
            v["password"].encode("utf-8"),
            bcrypt.gensalt(rounds=SALT_ROUNDS),
        ).decode("utf-8")

        db.users.create(data={
            "username":      v["username"],
            "phone_number":  v["phone_number"],
            "password_hash": pw_hash,
            "role":          "VENDOR",
        })
        print(f"[OK] Created vendor: {v['username']}  ({v['display']})")
        created += 1

    print(f"\n✅ Done. Created: {created}  Skipped: {skipped}")
    print("\nTest Login Credentials:")
    print("  Username : ahmed_grocery")
    print("  Password : Vendor@1234")
    print("  Portal   : http://localhost:5001/vendor/login")


if __name__ == "__main__":
    main()
