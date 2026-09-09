import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { partialNoDefaults } from "../../lib/zod.js";

// Tenant-owned org units for staff. Flat CRUD, same shape as expense/service
// categories — a business names its own departments and renames them freely,
// Employee.departmentId keeps pointing at the same row. Not gated to a module.
export const departmentsRouter = Router();

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: optionalText(255),
  isActive: z.boolean().default(true),
});
const updateSchema = partialNoDefaults(createSchema);

const tenantId = (req: { tenantId?: string }) => {
  if (!req.tenantId) throw new Error("Tenant context is required");
  return req.tenantId;
};

const departmentFields = {
  id: true,
  name: true,
  description: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { employees: true } },
} as const;

departmentsRouter.get("/", async (req, res) => {
  const query = z.object({ active: z.enum(["true", "false"]).optional(), search: optionalText(80) }).safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid department filters", details: query.error.flatten() }); return; }
  const { active, search } = query.data;
  const departments = await prisma.department.findMany({
    where: {
      tenantId: tenantId(req),
      ...(active ? { isActive: active === "true" } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    },
    select: departmentFields,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  res.json({ departments });
});

departmentsRouter.post("/", async (req, res, next) => {
  const data = createSchema.safeParse(req.body);
  if (!data.success) { res.status(400).json({ error: "Invalid department", details: data.error.flatten() }); return; }
  try {
    const department = await prisma.department.create({ data: { tenantId: tenantId(req), ...data.data }, select: departmentFields });
    res.status(201).json({ department });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "A department with this name already exists" }); return; }
    next(error);
  }
});

departmentsRouter.patch("/:id", async (req, res, next) => {
  const data = updateSchema.safeParse(req.body);
  if (!data.success) { res.status(400).json({ error: "Invalid department", details: data.error.flatten() }); return; }
  const tid = tenantId(req);
  try {
    const updated = await prisma.department.updateMany({ where: { id: req.params.id, tenantId: tid }, data: data.data });
    if (!updated.count) { res.status(404).json({ error: "Department not found" }); return; }
    const department = await prisma.department.findUniqueOrThrow({ where: { id: req.params.id }, select: departmentFields });
    res.json({ department });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") { res.status(409).json({ error: "A department with this name already exists" }); return; }
    next(error);
  }
});

departmentsRouter.delete("/:id", async (req, res) => {
  const tid = tenantId(req);
  const existing = await prisma.department.findFirst({ where: { id: req.params.id, tenantId: tid }, select: { id: true, _count: { select: { employees: true } } } });
  if (!existing) { res.status(404).json({ error: "Department not found" }); return; }
  if (existing._count.employees > 0) { res.status(409).json({ error: "Move its employees to another department first" }); return; }
  await prisma.department.delete({ where: { id: existing.id } });
  res.status(204).send();
});
