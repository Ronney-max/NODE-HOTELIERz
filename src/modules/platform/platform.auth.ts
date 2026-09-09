import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";

/**
 * Gates every /api/platform route with a real per-person session — TANZ
 * staff sign in with an email + password (see platform.routes.ts's
 * /auth/login) and get a bearer token backed by a PlatformSession row.
 * This sits above all tenants — there's no x-tenant-id here — and replaces
 * the old single shared PLATFORM_ADMIN_KEY.
 */

const bearerToken = (req: Request): string | null => {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
};

export async function platformAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = bearerToken(req);
    if (!token) { res.status(401).json({ error: "Not authenticated" }); return; }

    const session = await prisma.platformSession.findUnique({
      where: { token },
      include: { admin: true },
    });
    if (!session || session.expiresAt < new Date() || !session.admin.isActive) {
      res.status(401).json({ error: "Session expired" });
      return;
    }

    req.platformAdmin = { id: session.admin.id, email: session.admin.email, name: session.admin.name };
    next();
  } catch (error) {
    next(error);
  }
}
