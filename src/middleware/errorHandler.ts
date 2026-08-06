import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";

import { env } from "../config/env.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  let message = err instanceof Error ? err.message : "Internal Server Error";
  let status =
    typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : 500;

  // Expected database constraint failures are request errors, not server
  // failures. Keeping these messages predictable makes the POS UI usable.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      status = 409;
      message = "A record with those details already exists";
    } else if (err.code === "P2003") {
      status = 400;
      message = "The referenced record does not exist or cannot be changed";
    } else if (err.code === "P2025") {
      status = 404;
      message = "Record not found";
    }
  }

  if (env.NODE_ENV === "development" && err instanceof Error) {
    console.error(err.stack);
  } else {
    console.error(message);
  }

  res.status(status).json({ error: message });
}
