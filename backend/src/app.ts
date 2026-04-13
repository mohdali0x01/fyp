import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import { v4 as uuidv4 } from "uuid";

import authRoutes from "./routes/auth.routes";
import registrationRoutes from "./routes/registration.routes";
import { errorHandler } from "./middleware/error.middleware";

// ─── CRITICAL STARTUP VALIDATION ─────────────────────────────────────────────
// Warn operators if dangerous defaults are used in production
if (process.env.NODE_ENV === "production") {
  const KNOWN_UNSAFE_KEY = "0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63";
  if (process.env.AIDLEDGER_PRIVATE_KEY === KNOWN_UNSAFE_KEY) {
    throw new Error(
      "FATAL: Production is using the default test private key. " +
      "Set a secure AIDLEDGER_PRIVATE_KEY in your production environment."
    );
  }
  if (!process.env.FRONTEND_URL) {
    console.warn("[Security] WARNING: FRONTEND_URL not set in production — CORS will be restrictive.");
  }
}

const app = express();

// Trust the first proxy (required for rate limiting to work correctly with proxies/localhost)
// This ensures req.ip returns the real client IP, not the proxy IP.
app.set("trust proxy", 1);

// ─── REQUEST CORRELATION IDs ─────────────────────────────────────────────────
// Attach a unique request ID to every request for audit trail correlation.
// The ID appears in logs and is returned in response headers so clients
// can reference it when reporting issues.
app.use((req: Request, res: Response, next: NextFunction) => {
  const requestId = (req.headers["x-request-id"] as string) || uuidv4();
  req.headers["x-request-id"] = requestId;
  res.setHeader("X-Request-ID", requestId);
  next();
});

// ─── SECURITY HEADERS ─────────────────────────────────────────────────────────
// Helmet: Sets secure HTTP headers (XSS protection, no sniff, HSTS, etc.)
// For a pure API server (no HTML), we disable CSP and only set strict headers.
app.use(
  helmet({
    contentSecurityPolicy: false, // API-only server — no HTML rendered
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Only allow requests from the configured frontend origin.
// Credentials allowed so browsers can send HttpOnly cookies (future).
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3001",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposedHeaders: ["X-Request-ID"],
    credentials: true,
  })
);

// ─── HTTP PARAMETER POLLUTION PROTECTION ─────────────────────────────────────
// Prevents attackers from sending duplicate query params to confuse route logic.
// Example: ?role=ADMIN&role=BENEFICIARY would be collapsed to just the last value.
app.use(hpp());

// ─── RATE LIMITING ───────────────────────────────────────────────────────────

// General limiter: 100 requests per 15 minutes across all routes
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});
app.use(limiter);

// Auth-specific limiter: 10 attempts per 15 minutes (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many authentication attempts. Please try again in 15 minutes." },
  skipSuccessfulRequests: true, // Only count failed attempts against the limit
});

// ─── BODY PARSING ─────────────────────────────────────────────────────────────
// Strict 10kb limit prevents large payload DoS attacks.
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ─── REQUEST LOGGING ──────────────────────────────────────────────────────────
// "dev" format in development (colorized, verbose)
// "tiny" format in production (minimal PII exposure, smaller log volume)
if (process.env.NODE_ENV !== "test") {
  const morganFormat = process.env.NODE_ENV === "production" ? "tiny" : "dev";
  app.use(morgan(morganFormat));
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
// No sensitive data returned — usable by load balancers without authentication
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "OK", service: "AidLedger API" });
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/registration", registrationRoutes);

// ─── 404 HANDLER ──────────────────────────────────────────────────────────────
// Match-all — returns the same response regardless of what path was attempted
// (Do NOT echo the path back to prevent reflected injection)
app.use((_req, res) => {
  res.status(404).json({ message: "Resource not found." });
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
// Must be LAST — catches all errors passed via next(err)
app.use(errorHandler);

export default app;
