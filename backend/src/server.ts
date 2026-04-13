import app from "./app";
import { prisma } from "./config/prisma";
import { verifyBlockchainConnection } from "./services/blockchain.service";

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Attempt database connection before starting the server
    await prisma.$connect();
    console.log("✅ Successfully connected to PostgreSQL database (Prisma).");

    // Verify blockchain node is reachable (non-fatal warning if offline)
    await verifyBlockchainConnection();


    const server = app.listen(PORT, () => {
      console.log(`🚀 AidLedger Backend running on http://localhost:${PORT}`);
    });

    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        console.log("HTTP server closed.");
        await prisma.$disconnect();
        console.log("Database connection closed.");
        process.exit(0);
      });
    };

    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
