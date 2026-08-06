import { Router } from "express";
import { z } from "zod";

import { requireModule } from "../../middleware/tenantContext.js";
import { prisma } from "../../lib/prisma.js";

// POS configuration, stores, and stock all remain scoped to the tenant supplied
// by the authenticated request context (currently x-tenant-id during scaffolding).
export const posRouter = Router();

posRouter.use(requireModule("POS"));

const settingsSchema = z.object({
  cafeName: z.string().trim().min(2).max(120),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  inventoryEnabled: z.boolean(),
  lowStockAlerts: z.boolean(),
});

const storeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  code: z.string().trim().min(2).max(20).transform((value) => value.toUpperCase()),
});

const itemSchema = z.object({
  storeId: z.string().cuid(),
  name: z.string().trim().min(2).max(120),
  sku: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()),
  unit: z.string().trim().min(1).max(20).default("each"),
  quantity: z.coerce.number().min(0),
  reorderLevel: z.coerce.number().min(0),
});

const menuItemSchema = z.object({
  category: z.string().trim().min(2).max(60),
  inventoryItemId: z.string().cuid().optional(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(280).optional(),
  price: z.coerce.number().positive(),
  temperature: z.enum(["HOT", "COLD", "OTHER"]).default("OTHER"),
  isAvailable: z.boolean().default(true),
});

const adjustmentSchema = z.object({
  quantity: z.coerce.number().finite().refine((value) => value !== 0, "Quantity cannot be zero"),
});

function tenantIdFor(request: { tenantId?: string }): string {
  if (!request.tenantId) throw new Error("Tenant context is required");
  return request.tenantId;
}

posRouter.get("/orders", (_req, res) => {
  res.status(200).json({ orders: [] });
});

posRouter.get("/orders/:id", (req, res) => {
  res.status(200).json({ id: req.params.id, items: [], total: 0 });
});

/** Returns the full configuration needed to operate a café POS. */
posRouter.get("/settings", async (req, res) => {
  const tenantId = tenantIdFor(req);
  const [settings, stores, inventory] = await Promise.all([
    prisma.cafeSettings.findUnique({ where: { tenantId } }),
    prisma.store.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.inventoryItem.findMany({ where: { tenantId }, include: { store: true }, orderBy: { name: "asc" } }),
  ]);

  res.status(200).json({ settings, stores, inventory });
});

/** Creates or updates the café-wide POS and inventory policy. */
posRouter.put("/settings", async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid café settings", details: parsed.error.flatten() });
    return;
  }

  const settings = await prisma.cafeSettings.upsert({
    where: { tenantId: tenantIdFor(req) },
    create: { tenantId: tenantIdFor(req), ...parsed.data },
    update: parsed.data,
  });

  res.status(200).json({ settings });
});

posRouter.post("/stores", async (req, res) => {
  const parsed = storeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid store", details: parsed.error.flatten() });
    return;
  }

  const store = await prisma.store.create({
    data: { tenantId: tenantIdFor(req), ...parsed.data },
  });
  res.status(201).json({ store });
});

posRouter.post("/inventory/items", async (req, res) => {
  const parsed = itemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid inventory item", details: parsed.error.flatten() });
    return;
  }

  const tenantId = tenantIdFor(req);
  const store = await prisma.store.findFirst({ where: { id: parsed.data.storeId, tenantId, isActive: true } });
  if (!store) {
    res.status(400).json({ error: "Choose an active store belonging to this café" });
    return;
  }

  const item = await prisma.inventoryItem.create({ data: { tenantId, ...parsed.data } });
  res.status(201).json({ item });
});

/** Lists the café items the cashier can add to an order. */
posRouter.get("/menu-items", async (req, res) => {
  const items = await prisma.menuItem.findMany({
    where: { tenantId: tenantIdFor(req), isAvailable: true },
    include: { category: true, inventoryItem: true },
    orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
  });
  res.status(200).json({ items });
});

/** Adds a saleable café item, such as a hot latte or iced tea, to the POS menu. */
posRouter.post("/menu-items", async (req, res) => {
  const parsed = menuItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid menu item", details: parsed.error.flatten() });
    return;
  }

  const tenantId = tenantIdFor(req);
  if (parsed.data.inventoryItemId) {
    const inventoryItem = await prisma.inventoryItem.findFirst({
      where: { id: parsed.data.inventoryItemId, tenantId, isActive: true },
    });
    if (!inventoryItem) {
      res.status(400).json({ error: "Choose an active inventory item belonging to this café" });
      return;
    }
  }

  const { category, inventoryItemId, ...menuItemData } = parsed.data;
  const item = await prisma.menuItem.create({
    data: {
      ...menuItemData,
      tenant: { connect: { id: tenantId } },
      ...(inventoryItemId ? { inventoryItem: { connect: { id: inventoryItemId } } } : {}),
      category: {
        connectOrCreate: {
          where: { tenantId_name: { tenantId, name: category } },
          create: { tenantId, name: category },
        },
      },
    },
    include: { category: true, inventoryItem: true },
  });

  res.status(201).json({ item });
});

/** Use a signed quantity to receive stock (+) or record stock usage/waste (-). */
posRouter.post("/inventory/items/:id/adjust", async (req, res) => {
  const parsed = adjustmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid stock adjustment", details: parsed.error.flatten() });
    return;
  }

  const tenantId = tenantIdFor(req);
  // The conditional update prevents simultaneous requests from taking stock
  // below zero (a read-then-update check alone is vulnerable to a race).
  const minimumQuantity = parsed.data.quantity < 0 ? Math.abs(parsed.data.quantity) : undefined;
  const updated = await prisma.inventoryItem.updateMany({
    where: {
      id: req.params.id,
      tenantId,
      ...(minimumQuantity === undefined ? {} : { quantity: { gte: minimumQuantity } }),
    },
    data: { quantity: { increment: parsed.data.quantity } },
  });

  if (updated.count === 0) {
    const exists = await prisma.inventoryItem.findFirst({ where: { id: req.params.id, tenantId } });
    res.status(exists ? 400 : 404).json({
      error: exists ? "Stock cannot fall below zero" : "Inventory item not found",
    });
    return;
  }

  const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: req.params.id } });
  res.status(200).json({ item });
});
