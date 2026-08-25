-- AlterTable: new descriptive columns + roomTypeId added nullable first,
-- backfilled below, then locked to NOT NULL + FK once every row has a value.
ALTER TABLE "Room" ADD COLUMN     "floor" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "roomTypeId" TEXT,
ADD COLUMN     "wing" TEXT;

-- Defensive: for any Room whose `type` string doesn't match an existing
-- RoomType by name for the same tenant, auto-create a matching RoomType so
-- no room loses its type during the cutover. Verified against the live DB
-- (14 rooms / 14 room types, 0 orphans) that this branch is a no-op today —
-- it exists purely so the migration is safe on any other database state.
INSERT INTO "RoomType" ("id", "tenantId", "name", "capacity", "baseRate", "amenities", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text,
       r."tenantId", r."type", MIN(r."capacity"), MIN(r."nightlyRate"), '{}', true, now(), now()
FROM "Room" r
LEFT JOIN "RoomType" rt ON rt."tenantId" = r."tenantId" AND rt."name" = r."type"
WHERE rt."id" IS NULL
GROUP BY r."tenantId", r."type";

-- Backfill: every Room.type string is now guaranteed to match some RoomType
-- by (tenantId, name).
UPDATE "Room" r
SET "roomTypeId" = rt."id"
FROM "RoomType" rt
WHERE rt."tenantId" = r."tenantId" AND rt."name" = r."type";

-- Lock down + FK once every row has a value.
ALTER TABLE "Room" ALTER COLUMN "roomTypeId" SET NOT NULL;
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Room_tenantId_roomTypeId_idx" ON "Room"("tenantId", "roomTypeId");

-- Drop the now-obsolete free-text column.
ALTER TABLE "Room" DROP COLUMN "type";
