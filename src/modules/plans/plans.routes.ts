import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../../lib/prisma.js";
import { partialNoDefaults } from "../../lib/zod.js";

// The shared subscription catalog, maintained by TANZ staff in the platform
// admin app. Mounted under /api/platform/plans — already behind platformAuth
// (see platform.routes.ts). No tenant scoping: Plans sit above every tenant,
// a Tenant just references one (Tenant.planId) and snapshots its limits.
export const plansRouter = Router();

const money = z.coerce.number().min(0).max(99_999_999);

const createPlanSchema = z.object({
  name: z.string().trim().min(2).max(120),
  billingType: z.enum(["MONTHLY", "ONE_TIME"]).default("MONTHLY"),
  currency: z.enum(["KES", "UGX", "TZS", "USD"]).default("KES"),
  monthlyPrice: money.default(0),
  oneTimePrice: money.default(0),
  annualMaintenanceFee: money.default(0),
  supportLevel: z.string().trim().max(120).optional(),
  maxBranches: z.coerce.number().int().min(1).max(10_000).default(1),
  maxUsers: z.coerce.number().int().min(1).max(100_000).default(10),
  maxDevices: z.coerce.number().int().min(1).max(100_000).default(10),
  description: z.string().trim().max(2_000).optional(),
  isActive: z.boolean().default(true),
});

const updatePlanSchema = partialNoDefaults(createPlanSchema);

const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  active: z.enum(["true", "false"]).optional(),
});

// Decimal columns serialise to strings through res.json — normalise to
// numbers so the admin UI doesn't have to parse them everywhere.
function publicPlan<T extends { monthlyPrice: Prisma.Decimal; oneTimePrice: Prisma.Decimal; annualMaintenanceFee: Prisma.Decimal }>(plan: T) {
  return {
    ...plan,
    monthlyPrice: Number(plan.monthlyPrice),
    oneTimePrice: Number(plan.oneTimePrice),
    annualMaintenanceFee: Number(plan.annualMaintenanceFee),
  };
}

plansRouter.get("/", async (req, res) => {
  const query = listQuerySchema.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid filters" }); return; }
  const plans = await prisma.plan.findMany({
    where: {
      ...(query.data.active ? { isActive: query.data.active === "true" } : {}),
      ...(query.data.q ? { name: { contains: query.data.q, mode: "insensitive" } } : {}),
    },
    include: { _count: { select: { tenants: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  res.status(200).json({
    plans: plans.map(({ _count, ...plan }) => ({ ...publicPlan(plan), tenantCount: _count.tenants })),
  });
});

plansRouter.post("/", async (req, res) => {
  const parsed = createPlanSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid plan details", details: parsed.error.flatten() }); return; }
  try {
    const plan = await prisma.plan.create({ data: parsed.data });
    res.status(201).json({ plan: publicPlan(plan) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "A plan with that name already exists" }); return; }
    throw error;
  }
});

plansRouter.get("/:id", async (req, res) => {
  const plan = await prisma.plan.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { tenants: true } } },
  });
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  const { _count, ...rest } = plan;
  res.status(200).json({ plan: { ...publicPlan(rest), tenantCount: _count.tenants } });
});

plansRouter.patch("/:id", async (req, res) => {
  const parsed = updatePlanSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid update", details: parsed.error.flatten() }); return; }
  try {
    const plan = await prisma.plan.update({ where: { id: req.params.id }, data: parsed.data });
    res.status(200).json({ plan: publicPlan(plan) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") { res.status(404).json({ error: "Plan not found" }); return; }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "A plan with that name already exists" }); return; }
    throw error;
  }
});

// Refuses while any tenant is still on the plan — deactivate it instead
// (PATCH isActive:false) so it drops out of the "assignable" list without
// orphaning anyone's snapshot.
plansRouter.delete("/:id", async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id }, include: { _count: { select: { tenants: true } } } });
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  if (plan._count.tenants > 0) {
    res.status(409).json({ error: `${plan._count.tenants} tenant(s) are still on this plan — deactivate it instead` });
    return;
  }
  await prisma.plan.delete({ where: { id: req.params.id } });
  res.status(204).send();
});
