import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const message = err instanceof Error ? err.message : "Internal Server Error";
  const status =
    typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : 500;

  if (env.NODE_ENV === "development" && err instanceof Error) {
    console.error(err.stack);
  } else {
    console.error(message);
  }

  res.status(status).json({ error: message });
}
