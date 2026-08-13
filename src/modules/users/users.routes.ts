import { Router } from "express";
import { randomBytes, scryptSync } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireModule } from "../../middleware/tenantContext.js";

// Authentication/actor roles are not implemented yet; this tenant-scoped CRUD
// defines the users and roles that the future auth layer will enforce.
export const usersRouter = Router();
usersRouter.use(requireModule("POS"));
const roles = ["SUPER_ADMIN", "OWNER", "MANAGER", "STAFF", "BARISTA", "STORE_KEEPER", "RECEPTIONIST", "HOUSEKEEPER"] as const;
const createSchema = z.object({ email: z.email().transform((value) => value.trim().toLowerCase()), password: z.string().min(8).max(128), firstName: z.string().trim().min(1).max(60), lastName: z.string().trim().min(1).max(60), role: z.enum(roles).default("STAFF"), isActive: z.boolean().default(true) });
const updateSchema = createSchema.partial().omit({ password: true }).extend({ password: z.string().min(8).optional() });
const listSchema = z.object({ search: z.string().trim().max(100).optional(), role: z.enum(roles).optional(), active: z.enum(["true", "false"]).optional() });
const tenantId = (req: { tenantId?: string }) => { if (!req.tenantId) throw new Error("Tenant context is required"); return req.tenantId; };
const publicFields = { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true, updatedAt: true } as const;
function hashPassword(password: string): string { const salt = randomBytes(16).toString("hex"); return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`; }

usersRouter.get("/", async (req, res) => {
  const query = listSchema.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid user filters", details: query.error.flatten() }); return; }
  const { search, role, active } = query.data;
  const where: Prisma.UserWhereInput = {
    tenantId: tenantId(req),
    ...(role ? { role } : {}),
    ...(active ? { isActive: active === "true" } : {}),
    ...(search ? { OR: [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ] } : {}),
  };
  const [users, total, activeCount] = await Promise.all([
    prisma.user.findMany({ where, select: publicFields, orderBy: [{ firstName: "asc" }, { lastName: "asc" }] }),
    prisma.user.count({ where: { tenantId: tenantId(req) } }),
    prisma.user.count({ where: { tenantId: tenantId(req), isActive: true } }),
  ]);
  res.json({ users, summary: { total, active: activeCount, inactive: total - activeCount } });
});
usersRouter.get("/:id", async (req, res) => { const user = await prisma.user.findFirst({ where: { id: req.params.id, tenantId: tenantId(req) }, select: publicFields }); if (!user) { res.status(404).json({ error: "User not found" }); return; } res.json({ user }); });
usersRouter.post("/", async (req, res, next) => { const data = createSchema.safeParse(req.body); if (!data.success) { res.status(400).json({ error: "Invalid user", details: data.error.flatten() }); return; } const { password, ...userData } = data.data; try { res.status(201).json({ user: await prisma.user.create({ data: { tenantId: tenantId(req), ...userData, password: hashPassword(password) }, select: publicFields }) }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "A user with this email already exists" }); return; } next(error); } });
usersRouter.patch("/:id", async (req, res, next) => { const data = updateSchema.safeParse(req.body); if (!data.success) { res.status(400).json({ error: "Invalid user", details: data.error.flatten() }); return; } const { password, ...userData } = data.data; try { const updated = await prisma.user.updateMany({ where: { id: req.params.id, tenantId: tenantId(req) }, data: { ...userData, ...(password ? { password: hashPassword(password) } : {}) } }); if (!updated.count) { res.status(404).json({ error: "User not found" }); return; } res.json({ user: await prisma.user.findUniqueOrThrow({ where: { id: req.params.id }, select: publicFields }) }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "A user with this email already exists" }); return; } next(error); } });
usersRouter.delete("/:id", async (req, res) => { const deleted = await prisma.user.deleteMany({ where: { id: req.params.id, tenantId: tenantId(req) } }); if (!deleted.count) { res.status(404).json({ error: "User not found" }); return; } res.status(204).send(); });
