import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import { requireModule } from "../../middleware/tenantContext.js";

export const housekeepingRouter = Router();
housekeepingRouter.use(requireModule("HOUSEKEEPING"));

const taskSchema = z.object({
  roomId: z.string().cuid(),
  type: z.enum(["CLEANING", "INSPECTION", "MAINTENANCE"]).default("CLEANING"),
  assignedTo: z.string().trim().min(2).max(100).optional(),
  notes: z.string().trim().max(500).optional(),
  dueAt: z.coerce.date().optional(),
});
const taskUpdateSchema = taskSchema.partial().extend({ status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional() });
function tenantId(req: { tenantId?: string }): string { if (!req.tenantId) throw new Error("Tenant context is required"); return req.tenantId; }

housekeepingRouter.get("/tasks", async (req, res) => {
  const tasks = await prisma.housekeepingTask.findMany({ where: { tenantId: tenantId(req) }, include: { room: true }, orderBy: [{ status: "asc" }, { dueAt: "asc" }] });
  res.json({ tasks });
});

housekeepingRouter.post("/tasks", async (req, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid housekeeping task", details: parsed.error.flatten() }); return; }
  const scopeTenantId = tenantId(req);
  const room = await prisma.room.findFirst({ where: { id: parsed.data.roomId, tenantId: scopeTenantId } });
  if (!room) { res.status(400).json({ error: "Choose a room from this property" }); return; }
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.housekeepingTask.create({ data: { tenantId: scopeTenantId, ...parsed.data }, include: { room: true } });
    if (parsed.data.type === "CLEANING") await tx.room.update({ where: { id: room.id }, data: { cleanliness: "DIRTY" } });
    return created;
  });
  res.status(201).json({ task });
});

housekeepingRouter.patch("/tasks/:id", async (req, res) => {
  const parsed = taskUpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid housekeeping task", details: parsed.error.flatten() }); return; }
  const existing = await prisma.housekeepingTask.findFirst({ where: { id: req.params.id, tenantId: tenantId(req) } });
  if (!existing) { res.status(404).json({ error: "Housekeeping task not found" }); return; }
  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.housekeepingTask.update({ where: { id: existing.id }, data: { ...parsed.data, ...(parsed.data.status === "COMPLETED" ? { completedAt: new Date() } : {}) }, include: { room: true } });
    if (parsed.data.status === "IN_PROGRESS") await tx.room.update({ where: { id: existing.roomId }, data: { cleanliness: "INSPECTING" } });
    if (parsed.data.status === "COMPLETED" && updated.type === "CLEANING") await tx.room.update({ where: { id: existing.roomId }, data: { cleanliness: "CLEAN" } });
    return updated;
  });
  res.json({ task });
});

housekeepingRouter.delete("/tasks/:id", async (req, res) => {
  const deleted = await prisma.housekeepingTask.deleteMany({ where: { id: req.params.id, tenantId: tenantId(req) } });
  if (!deleted.count) { res.status(404).json({ error: "Housekeeping task not found" }); return; }
  res.status(204).send();
});
