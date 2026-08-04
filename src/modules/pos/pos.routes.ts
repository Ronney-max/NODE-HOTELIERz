import { Router } from "express";

import { requireModule } from "../../middleware/tenantContext.js";

// POS (Point of Sale) module routes.
// Every route here is gated behind the tenant having the POS module enabled.
export const posRouter = Router();

posRouter.use(requireModule("POS"));

posRouter.get("/orders", (_req, res) => {
  res.status(200).json({ orders: [] });
});

posRouter.get("/orders/:id", (req, res) => {
  res.status(200).json({ id: req.params.id, items: [], total: 0 });
});
