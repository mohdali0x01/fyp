import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { signToken } from "../utils/jwt";
import { SignupInput, LoginInput } from "../validators/auth.validator";

const SALT_ROUNDS = 12; // Increased from default 10 for stronger hashing

// ─── SIGNUP ───────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/signup
 * Creates a new BENEFICIARY account.
 * 
 * Security:
 * - Password is hashed with bcrypt (12 rounds) before storage.
 * - Returns identical error messages for duplicate username/phone to prevent user enumeration.
 * - The password_hash is never returned in any response.
 */
export const signup = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, phone_number, password } = req.body as SignupInput;

    // Hash password before any DB operation
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await prisma.users.create({
      data: {
        username,
        phone_number,
        password_hash,
        role: "BENEFICIARY",
      },
    });

    // Issue JWT immediately so user is logged in after signup
    const token = signToken({
      userId: newUser.user_id,
      username: newUser.username,
      role: newUser.role,
    });

    res.status(201).json({
      message: "Account created successfully.",
      token,
      user: {
        user_id: newUser.user_id,
        username: newUser.username,
        role: newUser.role,
      },
    });
  } catch (err: unknown) {
    // Handle unique constraint violations (duplicate username or phone)
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint failed")
    ) {
      // Deliberately vague message to prevent user enumeration attacks
      res
        .status(409)
        .json({ message: "An account with these credentials already exists." });
      return;
    }
    next(err);
  }
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/login
 * Authenticates a user and returns a JWT.
 * 
 * Security:
 * - Uses constant-time bcrypt comparison (prevents timing attacks).
 * - Returns identical error for wrong username OR wrong password (prevents enumeration).
 */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { username, password } = req.body as LoginInput;

    const user = await prisma.users.findUnique({ where: { username } });

    // Always run bcrypt.compare even if user not found (constant-time — prevents timing attacks)
    const dummyHash =
      "$2b$12$invalidhashtopreventtimingattacksXXXXXXXXXXXXXXXXXXXX";
    const passwordMatch = await bcrypt.compare(
      password,
      user ? user.password_hash : dummyHash
    );

    if (!user || !passwordMatch) {
      res.status(401).json({ message: "Invalid username or password." });
      return;
    }

    const token = signToken({
      userId: user.user_id,
      username: user.username,
      role: user.role,
    });

    res.status(200).json({
      message: "Login successful.",
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    next(err);
  }
};
