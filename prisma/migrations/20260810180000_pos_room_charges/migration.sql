ALTER TABLE "PosOrder" ADD COLUMN "reservationId" TEXT;

CREATE INDEX "PosOrder_reservationId_idx" ON "PosOrder"("reservationId");

ALTER TABLE "PosOrder"
ADD CONSTRAINT "PosOrder_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
