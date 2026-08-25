import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";

// A single tenant-wide lookup, used universally wherever a "per X" unit is
// needed — not scoped to Services specifically, so kept as its own module.
export const unitsOfMeasureRouter = Router();

const createSchema = z.object({ name: z.string().trim().min(1).max(40) });
const updateSchema = createSchema.partial();

const tenantId = (req: { tenantId?: string }) => {
  if (!req.tenantId) throw new Error("Tenant context is required");
  return req.tenantId;
};

unitsOfMeasureRouter.get("/", async (req, res) => {
  const units = await prisma.unitOfMeasure.findMany({
    where: { tenantId: tenantId(req) },
    select: { id: true, name: true, createdAt: true, updatedAt: true, _count: { select: { services: true } } },
    orderBy: { name: "asc" },
  });
  res.json({ units });
});

unitsOfMeasureRouter.post("/", async (req, res, next) => {
  const data = createSchema.safeParse(req.body);
  if (!data.success) { res.status(400).json({ error: "Invalid unit", details: data.error.flatten() }); return; }
  try {
    const unit = await prisma.unitOfMeasure.create({ data: { tenantId: tenantId(req), ...data.data } });
    res.status(201).json({ unit });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "A unit with this name already exists" }); return; }
    next(error);
  }
});

unitsOfMeasureRouter.patch("/:id", async (req, res, next) => {
  const data = updateSchema.safeParse(req.body);
  if (!data.success) { res.status(400).json({ error: "Invalid unit", details: data.error.flatten() }); return; }
  const tid = tenantId(req);
  try {
    const updated = await prisma.unitOfMeasure.updateMany({ where: { id: req.params.id, tenantId: tid }, data: data.data });
    if (!updated.count) { res.status(404).json({ error: "Unit not found" }); return; }
    const unit = await prisma.unitOfMeasure.findUniqueOrThrow({ where: { id: req.params.id } });
    res.json({ unit });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "A unit with this name already exists" }); return; }
    next(error);
  }
});

unitsOfMeasureRouter.delete("/:id", async (req, res) => {
  const tid = tenantId(req);
  const existing = await prisma.unitOfMeasure.findFirst({ where: { id: req.params.id, tenantId: tid }, select: { id: true, _count: { select: { services: true } } } });
  if (!existing) { res.status(404).json({ error: "Unit not found" }); return; }
  if (existing._count.services > 0) { res.status(409).json({ error: "Reassign or remove its services first" }); return; }
  await prisma.unitOfMeasure.delete({ where: { id: existing.id } });
  res.status(204).send();
});
