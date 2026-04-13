import { z } from "zod";

// ─── Registration / Application Schema ───────────────────────────────────────
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

export type RegistrationInput = z.infer<typeof registrationSchema>;
