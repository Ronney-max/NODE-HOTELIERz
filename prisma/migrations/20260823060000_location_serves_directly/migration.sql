-- AlterTable: owner-controlled per-location toggle for whether a FOOD-channel
-- order needs a Kitchen ticket or is served the instant it's rung up.
ALTER TABLE "Location" ADD COLUMN "servesDirectly" BOOLEAN NOT NULL DEFAULT false;
