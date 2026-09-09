-- An employee can now be pinned to several locations. The old single
-- Employee.locationId FK becomes the implicit many-to-many _LocationStaff
-- join table; existing single assignments are carried over one-to-one.

-- CreateTable
CREATE TABLE "_LocationStaff" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_LocationStaff_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_LocationStaff_B_index" ON "_LocationStaff"("B");

-- AddForeignKey (A = Employee, B = Location)
ALTER TABLE "_LocationStaff" ADD CONSTRAINT "_LocationStaff_A_fkey" FOREIGN KEY ("A") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_LocationStaff" ADD CONSTRAINT "_LocationStaff_B_fkey" FOREIGN KEY ("B") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Carry over existing single-location assignments.
INSERT INTO "_LocationStaff" ("A", "B")
SELECT "id", "locationId" FROM "Employee" WHERE "locationId" IS NOT NULL;

-- Drop the old single FK.
ALTER TABLE "Employee" DROP CONSTRAINT "Employee_locationId_fkey";
ALTER TABLE "Employee" DROP COLUMN "locationId";
