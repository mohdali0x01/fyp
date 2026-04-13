import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "1h";

if (!JWT_SECRET) {
  throw new Error("FATAL: JWT_SECRET environment variable is not set.");
}

if (JWT_SECRET.length < 32) {
  throw new Error(
    "FATAL: JWT_SECRET is too short. Minimum 32 characters required for HS256 security."
  );
}

export interface JwtPayload {
  userId: number;
  username: string;
  role: string;
}

/**
 * Signs a JWT token containing the user's identity.
 * Tokens expire after the configured duration (default 1 hour).
 */
export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    algorithm: "HS256",
  });
};

/**
 * Verifies a JWT token and returns the decoded payload.
 * Throws an error if token is invalid or expired.
 */
export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};
