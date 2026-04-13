import { Router } from "express";
import { signup, login } from "../controllers/auth.controller";
import { validate } from "../middleware/validate.middleware";
import { signupSchema, loginSchema } from "../validators/auth.validator";

const router = Router();

// POST /api/auth/signup
router.post("/signup", validate(signupSchema), signup);

// POST /api/auth/login
router.post("/login", validate(loginSchema), login);

export default router;
