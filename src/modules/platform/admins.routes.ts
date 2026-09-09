import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import { hashSecret } from "../../lib/hash.js";
import { partialNoDefaults } from "../../lib/zod.js";

// Platform admin accounts — the people who can sign into this app. Mounted
// under /api/platform/admins, already behind platformAuth (see
// platform.routes.ts). Every admin is equal; there are no sub-roles yet.
export const adminsRouter = Router();

const publicAdmin = (admin: {
  id: string; email: string; name: string; isActive: boolean;
  lastLoginAt: Date | null; createdAt: Date;
}) => ({
  id: admin.id,
  email: admin.email,
  name: admin.name,
  isActive: admin.isActive,
  lastLoginAt: admin.lastLoginAt,
  createdAt: admin.createdAt,
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  isActive: z.boolean().default(true),
});

const updateSchema = partialNoDefaults(z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  // Present only when the caller is resetting this admin's password.
  password: z.string().min(8).max(200),
  isActive: z.boolean(),
}));

adminsRouter.get("/", async (_req, res) => {
  const admins = await prisma.platformAdmin.findMany({ orderBy: { createdAt: "asc" } });
  res.status(200).json({ admins: admins.map(publicAdmin) });
});

adminsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid account details", details: parsed.error.flatten() }); return; }
  const { password, ...rest } = parsed.data;
  try {
    const admin = await prisma.platformAdmin.create({ data: { ...rest, password: hashSecret(password) } });
    res.status(201).json({ admin: publicAdmin(admin) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "An account with that email already exists" }); return; }
    throw error;
  }
});

adminsRouter.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid update", details: parsed.error.flatten() }); return; }

  const target = await prisma.platformAdmin.findUnique({ where: { id: req.params.id } });
  if (!target) { res.status(404).json({ error: "Account not found" }); return; }

  const isSelf = req.platformAdmin?.id === target.id;
  const deactivating = parsed.data.isActive === false && target.isActive;

  if (deactivating && isSelf) { res.status(400).json({ error: "You can't deactivate your own account" }); return; }
  if (deactivating) {
    const activeCount = await prisma.platformAdmin.count({ where: { isActive: true } });
    if (activeCount <= 1) { res.status(400).json({ error: "At least one account must stay active" }); return; }
  }

  const { password, ...rest } = parsed.data;
  const data: Prisma.PlatformAdminUpdateInput = { ...rest };
  if (password) data.password = hashSecret(password);

  try {
    const admin = await prisma.platformAdmin.update({ where: { id: target.id }, data });
    // A deactivated (or password-reset) admin loses every live session.
    if (deactivating || password) {
      await prisma.platformSession.deleteMany({ where: { adminId: target.id, ...(isSelf ? { NOT: { token: bearer(req) ?? "" } } : {}) } });
    }
    res.status(200).json({ admin: publicAdmin(admin) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "An account with that email already exists" }); return; }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") { res.status(404).json({ error: "Account not found" }); return; }
    throw error;
  }
});

adminsRouter.delete("/:id", async (req, res) => {
  const target = await prisma.platformAdmin.findUnique({ where: { id: req.params.id } });
  if (!target) { res.status(404).json({ error: "Account not found" }); return; }
  if (req.platformAdmin?.id === target.id) { res.status(400).json({ error: "You can't delete your own account" }); return; }

  const totalCount = await prisma.platformAdmin.count();
  if (totalCount <= 1) { res.status(400).json({ error: "You can't delete the last account" }); return; }

  // PlatformSession has onDelete: Cascade — sessions go with the account.
  await prisma.platformAdmin.delete({ where: { id: target.id } });
  res.status(204).send();
});

function bearer(req: { header(name: string): string | undefined }): string | null {
  const header = req.header("authorization");
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;
}
