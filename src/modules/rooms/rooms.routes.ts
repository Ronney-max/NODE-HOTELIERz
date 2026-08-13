import { Router } from "express";
import { Prisma } from "@prisma/client";
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
const roomTypeSchema = z.object({ name: z.string().trim().min(2).max(60), description: z.string().trim().max(240).optional(), capacity: z.coerce.number().int().min(1).max(20), baseRate: z.coerce.number().nonnegative(), amenities: z.array(z.string().trim().min(1).max(50)).max(20).default([]), isActive: z.boolean().default(true) });

function tenantId(req: { tenantId?: string }): string {
  if (!req.tenantId) throw new Error("Tenant context is required");
  return req.tenantId;
}

roomsRouter.get("/types", async (req, res) => res.json({ types: await prisma.roomType.findMany({ where: { tenantId: tenantId(req) }, orderBy: [{ isActive: "desc" }, { name: "asc" }] }) }));
roomsRouter.post("/types", async (req, res, next) => { const parsed = roomTypeSchema.safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "Invalid room type", details: parsed.error.flatten() }); return; } try { res.status(201).json({ type: await prisma.roomType.create({ data: { tenantId: tenantId(req), ...parsed.data } }) }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "This room type already exists" }); return; } next(error); } });
roomsRouter.patch("/types/:id", async (req, res, next) => { const parsed = roomTypeSchema.partial().safeParse(req.body); if (!parsed.success) { res.status(400).json({ error: "Invalid room type", details: parsed.error.flatten() }); return; } const tid = tenantId(req); const existing = await prisma.roomType.findFirst({ where: { id: req.params.id, tenantId: tid } }); if (!existing) { res.status(404).json({ error: "Room type not found" }); return; } try { if (parsed.data.name && parsed.data.name !== existing.name) await prisma.room.updateMany({ where: { tenantId: tid, type: existing.name }, data: { type: parsed.data.name } }); res.json({ type: await prisma.roomType.update({ where: { id: existing.id }, data: parsed.data }) }); } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "This room type already exists" }); return; } next(error); } });
roomsRouter.delete("/types/:id", async (req, res) => { const tid = tenantId(req); const existing = await prisma.roomType.findFirst({ where: { id: req.params.id, tenantId: tid } }); if (!existing) { res.status(404).json({ error: "Room type not found" }); return; } const used = await prisma.room.count({ where: { tenantId: tid, type: existing.name } }); if (used) { res.status(409).json({ error: "This room type is assigned to rooms; deactivate it instead" }); return; } await prisma.roomType.delete({ where: { id: existing.id } }); res.status(204).send(); });

roomsRouter.get("/rooms", async (req, res) => {
  const rooms = await prisma.room.findMany({
    where: { tenantId: tenantId(req) },
    include: {
      _count: { select: { reservations: true } },
      reservations: {
        where: { status: "CHECKED_IN" },
        include: { customer: true, posOrders: { where: { status: { not: "CANCELLED" } }, include: { items: { include: { addons: true } } }, orderBy: { createdAt: "desc" } } },
      },
    },
    orderBy: { number: "asc" },
  });
  const summary = { total: rooms.length, vacant: rooms.filter((room) => room.status === "VACANT").length, occupied: rooms.filter((room) => room.status === "OCCUPIED").length, outOfService: rooms.filter((room) => room.status === "OUT_OF_SERVICE").length, dirty: rooms.filter((room) => room.cleanliness === "DIRTY").length };
  res.status(200).json({ rooms, summary });
});

roomsRouter.get("/rooms/:id", async (req, res) => {
  const room = await prisma.room.findFirst({
    where: { id: req.params.id, tenantId: tenantId(req) },
    include: { reservations: { include: { customer: true, posOrders: { include: { items: { include: { menuItem: true, addons: { include: { addon: true } } } } } } }, orderBy: { checkIn: "desc" }, take: 10 } },
  });
  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.status(200).json({ room });
});

roomsRouter.post("/rooms", async (req, res, next) => {
  const parsed = roomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid room", details: parsed.error.flatten() });
    return;
  }
  const tid = tenantId(req);
  if (!(await prisma.roomType.findFirst({ where: { tenantId: tid, name: parsed.data.type, isActive: true } }))) { res.status(400).json({ error: "Choose an active room type from the property catalog" }); return; }
  try { const room = await prisma.room.create({ data: { tenantId: tid, ...parsed.data } }); res.status(201).json({ room }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "This room number already exists" }); return; } next(error); }
});

roomsRouter.patch("/rooms/:id", async (req, res) => {
  const parsed = roomSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid room", details: parsed.error.flatten() });
    return;
  }
  const tid = tenantId(req);
  if (parsed.data.type && !(await prisma.roomType.findFirst({ where: { tenantId: tid, name: parsed.data.type, isActive: true } }))) { res.status(400).json({ error: "Choose an active room type from the property catalog" }); return; }
  const updated = await prisma.room.updateMany({
    where: { id: req.params.id, tenantId: tid },
    data: parsed.data,
  });
  if (!updated.count) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.status(200).json({ room: await prisma.room.findUniqueOrThrow({ where: { id: req.params.id } }) });
});

roomsRouter.delete("/rooms/:id", async (req, res, next) => {
  try { const deleted = await prisma.room.deleteMany({ where: { id: req.params.id, tenantId: tenantId(req) } }); if (!deleted.count) { res.status(404).json({ error: "Room not found" }); return; } res.status(204).send(); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") { res.status(409).json({ error: "Rooms with reservation history cannot be deleted; mark it out of service instead" }); return; } next(error); }
});
