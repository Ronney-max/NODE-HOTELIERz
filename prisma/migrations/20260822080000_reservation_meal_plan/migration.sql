-- Reservation.mealPlan: which RoomRate tier (Room Only / B&B / Half Board /
-- Full Board) this stay is billed at. Existing rows default to ROOM_ONLY,
-- matching the room-charge amount they were already billed at (room.nightlyRate).
ALTER TABLE "Reservation" ADD COLUMN "mealPlan" "MealPlan" NOT NULL DEFAULT 'ROOM_ONLY';
