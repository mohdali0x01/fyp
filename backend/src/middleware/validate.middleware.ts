import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

/**
 * VALIDATION MIDDLEWARE FACTORY
 * Creates an Express middleware that validates req.body against a given Zod schema.
 * Returns 400 with formatted errors on failure; never passes invalid data downstream.
 */
export const validate =
  (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Format Zod errors into a clean, user-friendly structure
      // Security: result.error.issues is the standard way to access validation problems
      const issues = result.error.issues || [];
      const errors = issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      res.status(400).json({ message: "Validation failed.", errors });
      return;
    }

    // Replace req.body with the safely parsed & typed data (strips unknown fields)
    req.body = result.data;
    next();
  };
