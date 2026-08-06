import { Router } from "express";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import { requireModule } from "../../middleware/tenantContext.js";

// Room inventory is shared with Reception: a room created here is immediately
// selectable for reservations, check-in, and check-out.
export const roomsRouter = Router();
roomsRouter.use(requireModule("ROOMS"));

const roomSchema = z.object({
  number: z.string().trim().min(1).max(20),
  name: z.string().trim().max(80).optional(),
  type: z.string().trim().min(2).max(60),
  capacity: z.coerce.number().int().min(1).max(20).default(2),
  nightlyRate: z.coerce.number().nonnegative(),
  status: z.enum(["VACANT", "OCCUPIED", "OUT_OF_SERVICE"]).default("VACANT"),
  cleanliness: z.enum(["CLEAN", "DIRTY", "INSPECTING"]).default("CLEAN"),
});

function tenantId(req: { tenantId?: string }): string {
  if (!req.tenantId) throw new Error("Tenant context is required");
  return req.tenantId;
}

roomsRouter.get("/rooms", async (req, res) => {
  const rooms = await prisma.room.findMany({
    where: { tenantId: tenantId(req) },
    include: { _count: { select: { reservations: true } } },
    orderBy: { number: "asc" },
  });
  res.status(200).json({ rooms });
});

roomsRouter.get("/rooms/:id", async (req, res) => {
  const room = await prisma.room.findFirst({
    where: { id: req.params.id, tenantId: tenantId(req) },
    include: { reservations: { include: { customer: true }, orderBy: { checkIn: "desc" }, take: 10 } },
  });
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.status(200).json({ room });
});

roomsRouter.post("/rooms", async (req, res) => {
  const parsed = roomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid room", details: parsed.error.flatten() });
    return;
  }
  const room = await prisma.room.create({ data: { tenantId: tenantId(req), ...parsed.data } });
  res.status(201).json({ room });
});

roomsRouter.patch("/rooms/:id", async (req, res) => {
  const parsed = roomSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid room", details: parsed.error.flatten() });
    return;
  }
  const updated = await prisma.room.updateMany({
    where: { id: req.params.id, tenantId: tenantId(req) },
    data: parsed.data,
  });
  if (!updated.count) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.status(200).json({ room: await prisma.room.findUniqueOrThrow({ where: { id: req.params.id } }) });
});

roomsRouter.delete("/rooms/:id", async (req, res) => {
  const deleted = await prisma.room.deleteMany({ where: { id: req.params.id, tenantId: tenantId(req) } });
  if (!deleted.count) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.status(204).send();
});
