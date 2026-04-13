import { z } from "zod";

// ─── Signup — mirrors backend signupSchema exactly ───────────────────────────
export const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(100, "Username must be at most 100 characters")
      .regex(
        /^[a-zA-Z0-9_]+$/,
        "Username can only contain letters, numbers, and underscores"
      ),
    phone_number: z
      .string()
      .regex(
        /^(\+92|0)[0-9]{10}$/,
        "Must be a valid Pakistani number (e.g. 03001234567)"
      ),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[a-z]/, "Must contain at least one lowercase letter")
      .regex(/[0-9]/, "Must contain at least one number")
      .regex(
        /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
        "Must contain at least one special character"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignupFormValues = z.infer<typeof signupSchema>;

// ─── Login ───────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

// ─── Registration / Application — mirrors backend registrationSchema ─────────
export const registrationSchema = z.object({
  full_name: z
    .string()
    .min(3, "Full name must be at least 3 characters")
    .max(150, "Full name must be at most 150 characters")
    .regex(/^[a-zA-Z\s]+$/, "Full name can only contain letters and spaces"),
  cnic: z
    .string()
    .regex(
      /^([0-9]{13}|[0-9]{5}-[0-9]{7}-[0-9]{1})$/,
      "CNIC must be 13 digits or in format: XXXXX-XXXXXXX-X"
    ),
  address: z
    .string()
    .min(10, "Address must be at least 10 characters")
    .max(500, "Address must be at most 500 characters"),
  city: z
    .string()
    .min(2, "City must be at least 2 characters")
    .max(100, "City must be at most 100 characters"),
});

export type RegistrationFormValues = z.infer<typeof registrationSchema>;
