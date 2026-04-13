import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";

// Extend Express Request to carry authenticated user info
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * AUTH MIDDLEWARE
 * Protects routes by requiring a valid Bearer JWT in the Authorization header.
 * Never reveals why validation failed to prevent user enumeration.
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ message: "Unauthorized: No token provided." });
      return;
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch {
    // Do NOT expose the specific JWT error (e.g., TokenExpiredError) — just say unauthorized.
    res.status(401).json({ message: "Unauthorized: Invalid or expired token." });
  }
};
