import { Request, Response, NextFunction } from "express";

/**
 * GLOBAL ERROR HANDLER
 * Must be registered as the LAST middleware in Express.
 * 
 * Security: Never exposes stack traces or internal error details in production.
 * All errors are logged server-side; clients receive only a generic message.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const isDev = process.env.NODE_ENV === "development";

  // Always log the full error server-side for debugging
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);

  res.status(500).json({
    message: "An internal server error occurred.",
    // Only expose error details in development mode
    ...(isDev && { error: err.message }),
  });
};
