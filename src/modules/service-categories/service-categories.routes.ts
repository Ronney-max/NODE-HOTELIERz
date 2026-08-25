import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { partialNoDefaults } from "../../lib/zod.js";

// Deliberately flat, cross-cutting tenant config (like locations/categories)
// rather than owned by a single operational module — services will be sold
// from Reception, Service Center, and potentially POS.
export const serviceCategoriesRouter = Router();

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  isActive: z.boolean().default(true),
});
const updateSchema = partialNoDefaults(createSchema);

const tenantId = (req: { tenantId?: string }) => {
  if (!req.tenantId) throw new Error("Tenant context is required");
  return req.tenantId;
};

serviceCategoriesRouter.get("/", async (req, res) => {
  const categories = await prisma.serviceCategory.findMany({
    where: { tenantId: tenantId(req) },
    select: { id: true, name: true, isActive: true, createdAt: true, updatedAt: true, _count: { select: { services: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  res.json({ categories });
});

serviceCategoriesRouter.post("/", async (req, res, next) => {
  const data = createSchema.safeParse(req.body);
  if (!data.success) { res.status(400).json({ error: "Invalid service category", details: data.error.flatten() }); return; }
  try {
    const category = await prisma.serviceCategory.create({ data: { tenantId: tenantId(req), ...data.data } });
    res.status(201).json({ category });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "A service category with this name already exists" }); return; }
    next(error);
  }
});

serviceCategoriesRouter.patch("/:id", async (req, res, next) => {
  const data = updateSchema.safeParse(req.body);
  if (!data.success) { res.status(400).json({ error: "Invalid service category", details: data.error.flatten() }); return; }
  const tid = tenantId(req);
  try {
    const updated = await prisma.serviceCategory.updateMany({ where: { id: req.params.id, tenantId: tid }, data: data.data });
    if (!updated.count) { res.status(404).json({ error: "Service category not found" }); return; }
    const category = await prisma.serviceCategory.findUniqueOrThrow({ where: { id: req.params.id } });
    res.json({ category });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "A service category with this name already exists" }); return; }
    next(error);
  }
});

serviceCategoriesRouter.delete("/:id", async (req, res) => {
  const tid = tenantId(req);
  const existing = await prisma.serviceCategory.findFirst({ where: { id: req.params.id, tenantId: tid }, select: { id: true, _count: { select: { services: true } } } });
  if (!existing) { res.status(404).json({ error: "Service category not found" }); return; }
  if (existing._count.services > 0) { res.status(409).json({ error: "Reassign or remove its services first" }); return; }
  await prisma.serviceCategory.delete({ where: { id: existing.id } });
  res.status(204).send();
});
