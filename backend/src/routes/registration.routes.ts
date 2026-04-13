import { Router } from "express";
import { applyForAid, getStatus } from "../controllers/registration.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { registrationSchema } from "../validators/registration.validator";

const router = Router();

// All registration routes require authentication
router.use(authenticate);

// POST /api/registration/apply
router.post("/apply", validate(registrationSchema), applyForAid);

// GET /api/registration/status
router.get("/status", getStatus);

export default router;
