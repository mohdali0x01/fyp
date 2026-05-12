"""
AidLedger — Staff Account Seed Script
Creates one account per staff role for testing/demo.
Run once: python3 seed_staff.py

Passwords are printed to console after creation.
"""
import os
import sys
import bcrypt

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from prisma import Prisma

SALT_ROUNDS = 12

STAFF_ACCOUNTS = [
    {
        "username":     "aidledger_admin",
        "phone_number": "03001111111",
        "password":     "AidLedger@123",
        "role":         "AIDLEDGER_ADMIN",
        "label":        "AidLedger System Administrator",
    },
    {
        "username":     "sbp_officer",
        "phone_number": "03002222222",
        "password":     "SBP@Pakistan1",
        "role":         "SBP_ADMIN",
        "label":        "State Bank of Pakistan Officer",
    },
    {
        "username":     "hbl_bank",
        "phone_number": "03003333333",
        "password":     "HBL@Bank2024",
        "role":         "BANK_ADMIN",
        "label":        "HBL / NBP Bank Representative",
    },
    {
        "username":     "nab_auditor",
        "phone_number": "03004444444",
        "password":     "NAB@Audit123",
        "role":         "AUDITOR",
        "label":        "NAB / AG Office Auditor",
    },
]


def main():
    db = Prisma()
    db.connect()
    print("\n" + "=" * 60)
    print("  AidLedger — Staff Account Seeder")
    print("=" * 60)

    created, skipped = 0, 0

    for acc in STAFF_ACCOUNTS:
        existing = db.users.find_unique(where={"username": acc["username"]})
        if existing:
            print(f"\n  ⚠  SKIPPED  [{acc['role']}]  {acc['username']} — already exists")
            skipped += 1
            continue

        pw_hash = bcrypt.hashpw(
            acc["password"].encode("utf-8"),
            bcrypt.gensalt(rounds=SALT_ROUNDS)
        ).decode("utf-8")

        db.users.create(data={
            "username":      acc["username"],
            "phone_number":  acc["phone_number"],
            "password_hash": pw_hash,
            "role":          acc["role"],
        })

        print(f"\n  ✅ CREATED  [{acc['role']}]")
        print(f"     Label    : {acc['label']}")
        print(f"     Username : {acc['username']}")
        print(f"     Password : {acc['password']}")
        print(f"     Portal   : http://localhost:5000/login")
        created += 1

    print("\n" + "=" * 60)
    print(f"  Done. Created: {created}  |  Skipped: {skipped}")
    print("=" * 60)

    if created > 0:
        print("\n  📋 PORTAL URLS AFTER LOGIN:")
        print("     AIDLEDGER_ADMIN → http://localhost:5000/admin")
        print("     SBP_ADMIN       → http://localhost:5000/sbp")
        print("     BANK_ADMIN      → http://localhost:5000/bank")
        print("     AUDITOR         → http://localhost:5000/audit")
        print("     BENEFICIARY     → http://localhost:5000/dashboard")
        print()
        print("  ⚠  IMPORTANT: Change these passwords before production use.\n")

    db.disconnect()


if __name__ == "__main__":
    main()
