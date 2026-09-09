import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { nextPurchaseNo } from "../../lib/sequence.js";
import { partialNoDefaults } from "../../lib/zod.js";

// Mirrors the PurchaseStatus enum in schema.prisma — kept as a local literal
// list to match how every other module validates enums (never importing the
// Prisma enum into Zod).
const PURCHASE_STATUSES = ["DRAFT", "ORDERED", "RECEIVED", "CANCELLED"] as const;
type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

// Purchase orders raised against a supplier. A document only — marking a PO
// RECEIVED does not move stock, post to the ledger, or touch the supplier
// balance yet (that lands with Goods Received). No requireModule gate,
// matching assets/expenses/suppliers.
export const purchasesRouter = Router();

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());
const optionalDate = z.preprocess(blankToUndefined, z.coerce.date().optional());

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const tenantId = (req: { tenantId?: string }) => {
  if (!req.tenantId) throw new Error("Tenant context is required");
  return req.tenantId;
};

const lineSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().min(0).default(0),
  note: optionalText(255),
});

const createSchema = z.object({
  supplierId: z.string().trim().min(1),
  orderDate: optionalDate,
  expectedDate: optionalDate,
  reference: optionalText(120),
  notes: optionalText(500),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  items: z.array(lineSchema).min(1, "Add at least one item"),
});
// Header fields stay editable while DRAFT; items are replaced wholesale when
// provided. Status changes go through POST /:id/status, not here.
const updateSchema = partialNoDefaults(createSchema).extend({
  items: z.array(lineSchema).min(1).optional(),
});

const statusSchema = z.object({
  status: z.enum(PURCHASE_STATUSES),
  note: optionalText(500),
});

const purchaseInclude = {
  supplier: { select: { id: true, name: true } },
  requisition: { select: { id: true, requisitionNo: true } },
  items: { include: { product: { select: { id: true, name: true, unit: true } } }, orderBy: { createdAt: "asc" } },
  createdByEmployee: { select: { id: true, firstName: true, lastName: true } },
  updatedByEmployee: { select: { id: true, firstName: true, lastName: true } },
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

function computeTotals<T extends { quantity: number; unitCost: number }>(items: T[], taxRate: number) {
  const lines = items.map((i) => ({ ...i, lineTotal: round2(i.quantity * i.unitCost) }));
  const subtotal = round2(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const taxAmount = round2(subtotal * (taxRate / 100));
  const total = round2(subtotal + taxAmount);
  return { lines, subtotal, taxAmount, total };
}

async function assertSupplier(tid: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, tenantId: tid }, select: { id: true, isActive: true } });
  if (!supplier) throw new HttpError(400, "Supplier not found");
  if (!supplier.isActive) throw new HttpError(400, "That supplier is inactive");
}

async function assertProducts(tid: string, items: { productId: string }[]) {
  const ids = [...new Set(items.map((i) => i.productId))];
  const found = await prisma.product.count({ where: { id: { in: ids }, tenantId: tid } });
  if (found !== ids.length) throw new HttpError(400, "One or more items reference a product that was not found");
}

// Which statuses each status may move to. RECEIVED and CANCELLED are terminal.
const ALLOWED_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  DRAFT: ["ORDERED", "CANCELLED"],
  ORDERED: ["RECEIVED", "CANCELLED"],
  RECEIVED: [],
  CANCELLED: [],
};

purchasesRouter.get("/", async (req, res, next) => {
  try {
    const query = z.object({
      search: optionalText(120),
      status: z.enum(PURCHASE_STATUSES).optional(),
      supplierId: z.string().trim().optional(),
    }).safeParse(req.query);
    if (!query.success) { res.status(400).json({ error: "Invalid purchase filters", details: query.error.flatten() }); return; }
    const { search, status, supplierId } = query.data;
    const tid = tenantId(req);
    const where: Prisma.PurchaseWhereInput = {
      tenantId: tid,
      ...(status ? { status } : {}),
      ...(supplierId ? { supplierId } : {}),
      ...(search ? { OR: [
        { purchaseNo: { contains: search, mode: "insensitive" } },
        { reference: { contains: search, mode: "insensitive" } },
        { supplier: { name: { contains: search, mode: "insensitive" } } },
      ] } : {}),
    };
    const purchases = await prisma.purchase.findMany({ where, include: purchaseInclude, orderBy: { createdAt: "desc" } });
    const byStatus = Object.fromEntries(PURCHASE_STATUSES.map((s) => [s, 0])) as Record<PurchaseStatus, number>;
    for (const p of purchases) byStatus[p.status] += 1;
    const openValue = purchases.filter((p) => p.status === "DRAFT" || p.status === "ORDERED").reduce((sum, p) => sum + Number(p.total), 0);
    res.json({ purchases, summary: { total: purchases.length, byStatus, openValue } });
  } catch (error) {
    next(error);
  }
});

purchasesRouter.get("/:id", async (req, res, next) => {
  try {
    const purchase = await prisma.purchase.findFirst({ where: { id: req.params.id, tenantId: tenantId(req) }, include: purchaseInclude });
    if (!purchase) { res.status(404).json({ error: "Purchase not found" }); return; }
    res.json({ purchase });
  } catch (error) {
    next(error);
  }
});

purchasesRouter.post("/", async (req, res, next) => {
  const data = createSchema.safeParse(req.body);
  if (!data.success) { res.status(400).json({ error: "Invalid purchase", details: data.error.flatten() }); return; }
  const tid = tenantId(req);
  const { supplierId, items, taxRate, orderDate, ...rest } = data.data;
  try {
    await assertSupplier(tid, supplierId);
    await assertProducts(tid, items);
    const { lines, subtotal, taxAmount, total } = computeTotals(items, taxRate);
    const purchaseNo = await nextPurchaseNo(tid);
    const purchase = await prisma.purchase.create({
      data: {
        tenantId: tid,
        purchaseNo,
        supplierId,
        taxRate,
        subtotal,
        taxAmount,
        total,
        createdBy: req.userId,
        ...(orderDate ? { orderDate } : {}),
        ...rest,
        items: { create: lines.map((l) => ({ productId: l.productId, quantity: l.quantity, unitCost: l.unitCost, lineTotal: l.lineTotal, note: l.note })) },
      },
      include: purchaseInclude,
    });
    res.status(201).json({ purchase });
  } catch (error) {
    if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "That purchase number is taken — try again" }); return; }
    next(error);
  }
});

purchasesRouter.patch("/:id", async (req, res, next) => {
  const data = updateSchema.safeParse(req.body);
  if (!data.success) { res.status(400).json({ error: "Invalid purchase", details: data.error.flatten() }); return; }
  const tid = tenantId(req);
  try {
    const existing = await prisma.purchase.findFirst({ where: { id: req.params.id, tenantId: tid }, include: { items: true } });
    if (!existing) { res.status(404).json({ error: "Purchase not found" }); return; }
    if (existing.status !== "DRAFT") { res.status(409).json({ error: `A ${existing.status.toLowerCase()} purchase can no longer be edited` }); return; }

    const { supplierId, items, taxRate, orderDate, ...rest } = data.data;
    if (supplierId) await assertSupplier(tid, supplierId);
    if (items) await assertProducts(tid, items);

    const effectiveTaxRate = taxRate ?? Number(existing.taxRate);
    const effectiveItems = (items ?? existing.items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity), unitCost: Number(i.unitCost), note: i.note ?? undefined })));
    const { lines, subtotal, taxAmount, total } = computeTotals(effectiveItems, effectiveTaxRate);

    const purchase = await prisma.$transaction(async (tx) => {
      if (items) {
        await tx.purchaseItem.deleteMany({ where: { purchaseId: existing.id } });
        await tx.purchaseItem.createMany({ data: lines.map((l) => ({ purchaseId: existing.id, productId: l.productId, quantity: l.quantity, unitCost: l.unitCost, lineTotal: l.lineTotal, note: l.note })) });
      }
      return tx.purchase.update({
        where: { id: existing.id },
        data: {
          ...rest,
          ...(supplierId ? { supplierId } : {}),
          ...(orderDate ? { orderDate } : {}),
          taxRate: effectiveTaxRate,
          subtotal,
          taxAmount,
          total,
          updatedBy: req.userId,
        },
        include: purchaseInclude,
      });
    });
    res.json({ purchase });
  } catch (error) {
    if (error instanceof HttpError) { res.status(error.status).json({ error: error.message }); return; }
    next(error);
  }
});

purchasesRouter.post("/:id/status", async (req, res, next) => {
  const data = statusSchema.safeParse(req.body);
  if (!data.success) { res.status(400).json({ error: "Invalid status change", details: data.error.flatten() }); return; }
  const tid = tenantId(req);
  try {
    const existing = await prisma.purchase.findFirst({ where: { id: req.params.id, tenantId: tid } });
    if (!existing) { res.status(404).json({ error: "Purchase not found" }); return; }
    const { status, note } = data.data;
    if (status === existing.status) { res.status(409).json({ error: `This purchase is already ${status.toLowerCase()}` }); return; }
    if (!ALLOWED_TRANSITIONS[existing.status].includes(status)) {
      res.status(409).json({ error: `Cannot move a ${existing.status.toLowerCase()} purchase to ${status.toLowerCase()}` });
      return;
    }
    const purchase = await prisma.purchase.update({
      where: { id: existing.id },
      data: {
        status,
        updatedBy: req.userId,
        ...(note ? { notes: note } : {}),
        ...(status === "ORDERED" ? { orderedAt: new Date() } : {}),
        ...(status === "RECEIVED" ? { receivedAt: new Date() } : {}),
      },
      include: purchaseInclude,
    });
    res.json({ purchase });
  } catch (error) {
    next(error);
  }
});

purchasesRouter.delete("/:id", async (req, res, next) => {
  try {
    const existing = await prisma.purchase.findFirst({ where: { id: req.params.id, tenantId: tenantId(req) }, select: { id: true, status: true } });
    if (!existing) { res.status(404).json({ error: "Purchase not found" }); return; }
    if (existing.status !== "DRAFT") { res.status(409).json({ error: "Only a draft purchase can be deleted — cancel it instead" }); return; }
    await prisma.purchase.delete({ where: { id: existing.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
