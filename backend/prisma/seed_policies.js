const { PrismaClient } = require('../src/generated/prisma');
const prisma = new PrismaClient();

async function syncPolicies() {
  console.log("🔄 Syncing Blockchain GRC Rules to PostgreSQL `policies` Cache...");

  try {
    // Invalidate old policies
    await prisma.policies.updateMany({
      data: { is_active: false }
    });

    // Create the active synced policy
    const newPolicy = await prisma.policies.create({
      data: {
        max_salary_allowed: 42000.00,
        max_family_members: 8,
        urban_pmt_limit: 38.00,
        rural_pmt_limit: 32.00,           // Last updated by AidLedger
        max_cash_limit: 10000.00,         // GRC compliance rule
        global_budget: 350000000000.00,   // SBP Initial Deployment
        is_active: true
      }
    });

    console.log("✅ Successfully synced policies table in PostgreSQL!");
    console.log(newPolicy);
  } catch (e) {
    console.error("❌ Failed to sync:", e);
  } finally {
    await prisma.$disconnect();
  }
}

syncPolicies();
