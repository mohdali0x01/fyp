import sys
import os

# Add the parent directory to the path so we can import the app modules if needed
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from prisma import Prisma

def sync_policies():
    print("🔄 Syncing Blockchain GRC Rules to PostgreSQL `policies` Cache...")
    
    db = Prisma()
    db.connect()
    
    try:
        # 1. Invalidate old policies
        db.policies.update_many(
            where={},
            data={"is_active": False}
        )
        
        # 2. Create the active synced policy
        # Note: We use floats here which the Prisma client will handle for Decimal fields
        new_policy = db.policies.create(
            data={
                "max_salary_allowed": 42000.00,
                "max_family_members": 8,
                "urban_pmt_limit": 38.00,
                "rural_pmt_limit": 32.00,
                "max_cash_limit": 10000.00,
                "global_budget": 350000000000.00,
                "is_active": True
            }
        )
        
        print("✅ Successfully synced policies table in PostgreSQL!")
        print(f"Policy ID: {new_policy.policy_id}")
        
    except Exception as e:
        print(f"❌ Failed to sync: {e}")
    finally:
        db.disconnect()

if __name__ == "__main__":
    sync_policies()
