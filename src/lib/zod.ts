import { z } from "zod";

// z.object({...}).partial() makes every field optional but does NOT strip
// any .default(...) already on those fields — Zod still applies a field's
// default whenever the key is absent from the input, not just when it's
// explicitly undefined. That's correct for "create with sensible fallbacks,"
// but wrong for "update — only change what's provided": a PATCH built from
// createSchema.partial() silently resets every omitted default-bearing
// field back to its default on every single partial update.
//
// This produces the schema a PATCH endpoint actually wants: every field
// optional, with defaults removed so an omitted key truly means "leave this
// alone," not "reset to default." Validation constraints on each field
// (min/max/enum/etc.) are preserved — only the default is stripped.
type StripDefault<T extends z.ZodTypeAny> = T extends z.ZodDefault<infer Inner> ? Inner : T;
type PartialNoDefaultsShape<Shape extends z.ZodRawShape> = {
  [K in keyof Shape]: Shape[K] extends z.ZodTypeAny ? z.ZodOptional<StripDefault<Shape[K]>> : never;
};

export function partialNoDefaults<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape>,
): z.ZodObject<PartialNoDefaultsShape<Shape>> {
  const shape = schema.shape as unknown as Record<string, z.ZodTypeAny>;
  const stripped: Record<string, z.ZodTypeAny> = {};
  for (const key in shape) {
    const field = shape[key];
    const base = (field instanceof z.ZodDefault ? field.removeDefault() : field) as z.ZodTypeAny;
    stripped[key] = base.optional();
  }
  return z.object(stripped) as unknown as z.ZodObject<PartialNoDefaultsShape<Shape>>;
}
