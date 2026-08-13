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
const taskListSchema = z.object({ status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED"]).optional(), type: z.enum(["CLEANING", "INSPECTION", "MAINTENANCE"]).optional(), roomId: z.string().cuid().optional() });
function tenantId(req: { tenantId?: string }): string { if (!req.tenantId) throw new Error("Tenant context is required"); return req.tenantId; }

housekeepingRouter.get("/rooms", async (req, res) => {
  const rooms = await prisma.room.findMany({ where: { tenantId: tenantId(req) }, orderBy: [{ cleanliness: "desc" }, { number: "asc" }] });
  res.json({ rooms, summary: { ready: rooms.filter((room) => room.status === "VACANT" && room.cleanliness === "CLEAN").length, needsService: rooms.filter((room) => room.cleanliness !== "CLEAN").length } });
});

housekeepingRouter.get("/tasks", async (req, res) => {
  const query = taskListSchema.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid task filters", details: query.error.flatten() }); return; }
  const tid = tenantId(req);
  const where = { tenantId: tid, ...query.data };
  const [tasks, pending, inProgress, completed] = await Promise.all([
    prisma.housekeepingTask.findMany({ where, include: { room: true }, orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }] }),
    prisma.housekeepingTask.count({ where: { tenantId: tid, status: "PENDING" } }),
    prisma.housekeepingTask.count({ where: { tenantId: tid, status: "IN_PROGRESS" } }),
    prisma.housekeepingTask.count({ where: { tenantId: tid, status: "COMPLETED" } }),
  ]);
  res.json({ tasks, summary: { pending, inProgress, completed } });
});

housekeepingRouter.get("/tasks/:id", async (req, res) => {
  const task = await prisma.housekeepingTask.findFirst({ where: { id: req.params.id, tenantId: tenantId(req) }, include: { room: true } });
  if (!task) { res.status(404).json({ error: "Housekeeping task not found" }); return; }
  res.json({ task });
});

housekeepingRouter.post("/tasks", async (req, res) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid housekeeping task", details: parsed.error.flatten() }); return; }
  const scopeTenantId = tenantId(req);
  const room = await prisma.room.findFirst({ where: { id: parsed.data.roomId, tenantId: scopeTenantId } });
  if (!room) { res.status(400).json({ error: "Choose a room from this property" }); return; }
  const duplicate = await prisma.housekeepingTask.findFirst({ where: { tenantId: scopeTenantId, roomId: room.id, type: parsed.data.type, status: { in: ["PENDING", "IN_PROGRESS"] } } });
  if (duplicate) { res.status(409).json({ error: `An active ${parsed.data.type.toLowerCase()} task already exists for room ${room.number}` }); return; }
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
  if (parsed.data.roomId && parsed.data.roomId !== existing.roomId) {
    const room = await prisma.room.findFirst({ where: { id: parsed.data.roomId, tenantId: tenantId(req) } });
    if (!room) { res.status(400).json({ error: "Choose a room from this property" }); return; }
  }
  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.housekeepingTask.update({ where: { id: existing.id }, data: { ...parsed.data, ...(parsed.data.status === "COMPLETED" ? { completedAt: new Date() } : parsed.data.status ? { completedAt: null } : {}) }, include: { room: true } });
    if (parsed.data.status === "IN_PROGRESS") await tx.room.update({ where: { id: updated.roomId }, data: { cleanliness: "INSPECTING" } });
    if (parsed.data.status === "COMPLETED" && ["CLEANING", "INSPECTION"].includes(updated.type)) await tx.room.update({ where: { id: updated.roomId }, data: { cleanliness: "CLEAN" } });
    return updated;
  });
  res.json({ task });
});

housekeepingRouter.delete("/tasks/:id", async (req, res) => {
  const deleted = await prisma.housekeepingTask.deleteMany({ where: { id: req.params.id, tenantId: tenantId(req) } });
  if (!deleted.count) { res.status(404).json({ error: "Housekeeping task not found" }); return; }
  res.status(204).send();
});
