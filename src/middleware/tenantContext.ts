import type { NextFunction, Request, Response } from "express";
import type { ModuleKey } from "@prisma/client";

import { prisma } from "../lib/prisma.js";

/**
 * Reads the `x-tenant-id` header and attaches it to `req.tenantId`.
 * There is no auth layer yet, so this is a simple pass-through that
 * lets downstream middleware (e.g. requireModule) resolve tenant scope.
 */
export function tenantContext(req: Request, _res: Response, next: NextFunction): void {
  const tenantId = req.header("x-tenant-id");
  if (tenantId) {
    req.tenantId = tenantId;
  }
  const userId = req.header("x-user-id");
  if (userId) {
    req.userId = userId;
  }
  next();
}

/**
 * Temporary role guard until session/JWT authentication is introduced.
 * The acting staff member is resolved from x-user-id within the current tenant;
 * only active owners and super admins may perform protected operations.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.tenantId || !req.userId) {
    res.status(401).json({ error: "An authenticated admin user is required" });
    return;
  }

  prisma.user
    .findFirst({
      where: {
        id: req.userId,
        tenantId: req.tenantId,
        isActive: true,
        role: { in: ["SUPER_ADMIN", "OWNER"] },
      },
      select: { id: true },
    })
    .then((admin) => {
      if (!admin) {
        res.status(403).json({ error: "Only a main admin can delete stores" });
        return;
      }
      next();
    })
    .catch(next);
}

/**
 * Middleware factory: ensures the current tenant (from req.tenantId)
 * has the given module enabled before allowing the request through.
 *
 * NOTE: since there is no auth/session layer yet, tenant identity comes
 * solely from the x-tenant-id header. This will be replaced by a proper
 * authenticated tenant lookup once auth is added.
 */
export function requireModule(moduleKey: ModuleKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { tenantId } = req;

      if (!tenantId) {
        res.status(400).json({ error: "Missing x-tenant-id header" });
        return;
      }

      const tenantModule = await prisma.tenantModule.findUnique({
        where: {
          tenantId_moduleKey: {
            tenantId,
            moduleKey,
          },
        },
      });

      if (!tenantModule || !tenantModule.isEnabled) {
        res.status(403).json({ error: "Module not enabled for this tenant" });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
