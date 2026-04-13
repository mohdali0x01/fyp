import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma";
import { runVerificationPipeline } from "../services/verification.service";
import { onChain_logApplication } from "../services/blockchain.service";
import { RegistrationInput } from "../validators/registration.validator";

// ─── APPLY FOR AID ────────────────────────────────────────────────────────────
/**
 * POST /api/registration/apply
 * Submits the beneficiary's aid application and triggers the verification pipeline.
 *
 * Security:
 * - Route is protected by authenticate middleware (JWT required).
 * - CNIC is stripped of formatting before storage to prevent bypass with different formats.
 * - A user cannot submit a second application if one already exists for their account.
 */
export const applyForAid = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { full_name, cnic, address, city } = req.body as RegistrationInput;
    const userId = req.user!.userId;

    // Normalize CNIC — strip dashes to match kyc_master (e.g., "42201-1234567-1" -> "4220112345671")
    // Security: Normalizing input prevents duplicate bypasses with different formatting.
    const normalizedCnic = cnic.replace(/-/g, "").trim();

    // Prevent duplicate applications from the same user
    const existingApplication = await prisma.registration.findFirst({
      where: { user_id: userId },
    });

    if (existingApplication) {
      res.status(409).json({
        message: "You have already submitted an application.",
        current_status: existingApplication.pipeline_status,
      });
      return;
    }

    // Prevent duplicate CNIC from different accounts
    const existingCnic = await prisma.registration.findUnique({
      where: { cnic: normalizedCnic },
    });

    if (existingCnic) {
      res.status(409).json({
        message: "An application with this CNIC already exists.",
      });
      return;
    }

    // Create registration record
    const registration = await prisma.registration.create({
      data: {
        user_id: userId,
        cnic: normalizedCnic,
        full_name,
        address,
        city,
        pipeline_status: "PENDING",
      },
    });

    // ── ANCHOR APPLICATION ON BLOCKCHAIN ─────────────────────────────────────
    // logApplication is called first — creates the immutable pipeline start event
    try {
      await onChain_logApplication(normalizedCnic);
    } catch (bcErr) {
      // Non-fatal: proceed with local pipeline even if Besu is temporarily unavailable
      console.error("[Blockchain] logApplication call failed (non-fatal):", bcErr);
    }

    // ── TRIGGER VERIFICATION PIPELINE ─────────────────────────────────────────
    // Runs asynchronously after the DB record is confirmed
    const verificationResult = await runVerificationPipeline(
      normalizedCnic,
      registration.registration_id
    );

    res.status(201).json({
      message: "Application submitted and verification completed.",
      registration_id: registration.registration_id,
      verification: verificationResult,
    });
  } catch (err) {
    next(err);
  }
};

// ─── CHECK STATUS ─────────────────────────────────────────────────────────────
/**
 * GET /api/registration/status
 * Returns the current pipeline status for the logged-in beneficiary.
 */
export const getStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const registration = await prisma.registration.findFirst({
      where: { user_id: userId },
      select: {
        registration_id: true,
        cnic: true,
        full_name: true,
        city: true,
        pipeline_status: true,
        created_at: true,
        // Include latest notification message
        notifications: {
          orderBy: { created_at: "desc" },
          take: 1,
          select: {
            message_text_urdu: true,
            created_at: true,
          },
        },
      },
    });

    if (!registration) {
      res
        .status(404)
        .json({ message: "No application found for this account." });
      return;
    }

    res.status(200).json({
      message: "Application status retrieved.",
      application: registration,
    });
  } catch (err) {
    next(err);
  }
};
