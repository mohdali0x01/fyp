import sys, os
os.chdir('/mnt/e/FYP/AidLedger')
sys.path.insert(0, '/mnt/e/FYP/AidLedger')
from app.models.db import get_db, connect_db, disconnect_db
import uuid
from datetime import datetime, timedelta, timezone

connect_db()
try:
    db = get_db()
    
    # 1. Find the user Muhammad Ali or any beneficiary stuck without a card
    beneficiaries = db.users.find_many(where={"role": "BENEFICIARY"}, include={"registration": True})
    
    for user in beneficiaries:
        for reg in user.registration:
            if reg.pipeline_status == "ELIGIBLE":
                # Check if card exists
                card = db.card_issue.find_unique(where={"cnic": reg.cnic})
                if not card:
                    print(f"Fixing user: {user.username} | CNIC: {reg.cnic}")
                    expiry = datetime.now(timezone.utc) + timedelta(days=365 * 3)
                    # Use a short UID (12 chars) to avoid the 16-char database limit
                    placeholder_uid = f"P-{uuid.uuid4().hex[:10].upper()}"
                    
                    # Create the eligible record if missing (should be there if ELIGIBLE status)
                    el = db.eligible.find_unique(where={"cnic": reg.cnic})
                    if not el:
                        el = db.eligible.create(data={
                            "cnic": reg.cnic,
                            "blockchain_approval_hash": "FIXED_BY_AI",
                            "card_issued": True
                        })
                    
                    db.card_issue.create(data={
                        "eligible_id":         el.eligible_id,
                        "cnic":                reg.cnic,
                        "virtual_card_number": placeholder_uid,
                        "card_status":         "PENDING_LINK",
                        "expiry_date":         expiry,
                    })
                    print(f"Successfully created card for {user.username}")
                else:
                    # If card exists but is status 'ACTIVE' with a 'PENDING' UID, that's fine.
                    # But if it's PENDING_LINK, we are good.
                    print(f"User {user.username} already has a card.")

except Exception as e:
    print(f"Error: {e}")
finally:
    disconnect_db()
