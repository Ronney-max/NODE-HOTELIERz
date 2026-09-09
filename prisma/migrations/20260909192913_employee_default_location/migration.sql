-- The location the POS pre-selects for an employee (one of their assigned
-- locations, or null). Seed it to the sole location for anyone pinned to
-- exactly one, so single-location staff are locked in from day one.

ALTER TABLE "Employee" ADD COLUMN "defaultLocationId" TEXT;

ALTER TABLE "Employee" ADD CONSTRAINT "Employee_defaultLocationId_fkey"
    FOREIGN KEY ("defaultLocationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Employee_defaultLocationId_idx" ON "Employee"("defaultLocationId");

UPDATE "Employee" e
SET "defaultLocationId" = sub."B"
FROM (
    SELECT "A", MIN("B") AS "B"
    FROM "_LocationStaff"
    GROUP BY "A"
    HAVING COUNT(*) = 1
) sub
WHERE sub."A" = e."id";
