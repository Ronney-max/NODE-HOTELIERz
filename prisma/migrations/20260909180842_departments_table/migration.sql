-- Replace the fixed EmployeeDepartment enum with a tenant-owned Department
-- table. Employee.department (enum) -> Employee.departmentId (FK). Existing
-- rows are migrated by seeding a standard department set per tenant and
-- mapping each old enum value to the matching new row.

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_name_key" ON "Department"("tenantId", "name");
CREATE INDEX "Department_tenantId_isActive_idx" ON "Department"("tenantId", "isActive");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the standard department set for every existing tenant.
INSERT INTO "Department" ("id", "tenantId", "name", "updatedAt")
SELECT gen_random_uuid()::text, t."id", d.name, CURRENT_TIMESTAMP
FROM "Tenant" t
CROSS JOIN (VALUES
    ('Reception'), ('Housekeeping'), ('Kitchen'), ('Sales'), ('Service Center'),
    ('Inventory'), ('Finance'), ('Management'), ('Maintenance'), ('Security')
) AS d(name);

-- Employee: add the FK column, backfill from the old enum, then enforce.
ALTER TABLE "Employee" ADD COLUMN "departmentId" TEXT;

UPDATE "Employee" e SET "departmentId" = d."id"
FROM "Department" d
WHERE d."tenantId" = e."tenantId" AND d."name" = CASE e."department"::text
    WHEN 'RECEPTION'      THEN 'Reception'
    WHEN 'HOUSEKEEPING'   THEN 'Housekeeping'
    WHEN 'KITCHEN'        THEN 'Kitchen'
    WHEN 'SALES'          THEN 'Sales'
    WHEN 'SERVICE_CENTER' THEN 'Service Center'
    WHEN 'INVENTORY'      THEN 'Inventory'
    WHEN 'FINANCE'        THEN 'Finance'
    WHEN 'MANAGEMENT'     THEN 'Management'
    WHEN 'MAINTENANCE'    THEN 'Maintenance'
    WHEN 'SECURITY'       THEN 'Security'
END;

-- Safety net: any employee still unmapped falls back to its tenant's Management.
UPDATE "Employee" e SET "departmentId" = d."id"
FROM "Department" d
WHERE e."departmentId" IS NULL AND d."tenantId" = e."tenantId" AND d."name" = 'Management';

ALTER TABLE "Employee" ALTER COLUMN "departmentId" SET NOT NULL;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop the old enum column + type, swap the index.
DROP INDEX "Employee_tenantId_department_idx";
ALTER TABLE "Employee" DROP COLUMN "department";
DROP TYPE "EmployeeDepartment";
CREATE INDEX "Employee_tenantId_departmentId_idx" ON "Employee"("tenantId", "departmentId");
