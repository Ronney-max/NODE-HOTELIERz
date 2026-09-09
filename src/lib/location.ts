import { prisma } from "./prisma.js";

/** The employee's fixed selling location, if they have one. Employees with
 * no fixed location can sell at any location (POS asks them to pick one). */
export async function employeeLocationId(tid: string, userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const employee = await prisma.employee.findFirst({ where: { id: userId, tenantId: tid }, select: { locationId: true } });
  return employee?.locationId ?? null;
}

/** Resolves which location a sale belongs to: a fixed-location employee
 * always sells at their own location, no matter what the client sends; an
 * unassigned employee's choice is used, validated as active in this tenant.
 * Returns location: null only when the property has never created any
 * location at all (the whole feature is opt-in). Blocks (returns an error)
 * when the location is genuinely ambiguous — used where business logic
 * (stock, sales totals) actually depends on knowing which location a sale
 * belongs to. */
export async function resolveEffectiveLocation(
  tid: string,
  userId: string | undefined,
  requestedLocationId: string | null | undefined,
): Promise<{ location: Awaited<ReturnType<typeof prisma.location.findFirst>> } | { error: string }> {
  const fixedLocationId = await employeeLocationId(tid, userId);
  const effectiveLocationId = fixedLocationId ?? requestedLocationId ?? null;
  if (!effectiveLocationId) {
    const locationCount = await prisma.location.count({ where: { tenantId: tid } });
    if (locationCount > 0) return { error: "Choose which location this sale is for" };
    return { location: null };
  }
  const location = await prisma.location.findFirst({ where: { id: effectiveLocationId, tenantId: tid, isActive: true } });
  if (!location) return { error: "Choose an active location from this property" };
  return { location };
}

/** Best-effort, never-blocking location capture for audit trails — just the
 * acting employee's fixed location, or null. Unlike resolveEffectiveLocation,
 * this never errors: recording "who did this, where" must not stop the
 * action itself just because the location isn't knowable (e.g. a floating
 * Manager with no fixed desk). */
export async function resolveActorLocation(tid: string, userId: string | undefined): Promise<string | null> {
  return employeeLocationId(tid, userId);
}
