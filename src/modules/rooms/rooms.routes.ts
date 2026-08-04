import { Router } from "express";

import { requireModule } from "../../middleware/tenantContext.js";

// Rooms module routes (hotel room inventory/status).
// Only tenants with the ROOMS module enabled can reach these endpoints.
export const roomsRouter = Router();

roomsRouter.use(requireModule("ROOMS"));

roomsRouter.get("/rooms", (_req, res) => {
  res.status(200).json({ rooms: [] });
});

roomsRouter.get("/rooms/:id", (req, res) => {
  res.status(200).json({ id: req.params.id, status: "vacant" });
});
