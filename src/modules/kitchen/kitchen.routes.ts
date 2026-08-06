import { Router } from "express";

import { prisma } from "../../lib/prisma.js";
import { requireModule } from "../../middleware/tenantContext.js";

// The kitchen reads the same menu configured in POS, so drink availability,
// pricing, and inventory links have a single source of truth.
export const kitchenRouter = Router();

kitchenRouter.use(requireModule("KITCHEN"));

kitchenRouter.get("/drink-offerings", async (req, res) => {
  if (!req.tenantId) {
    res.status(400).json({ error: "Missing x-tenant-id header" });
    return;
  }

  const drinks = await prisma.menuItem.findMany({
    where: { tenantId: req.tenantId, isAvailable: true },
    select: {
      id: true,
      name: true,
      description: true,
      temperature: true,
      category: { select: { name: true } },
      inventoryItem: { select: { id: true, name: true, quantity: true, unit: true } },
    },
    orderBy: [{ temperature: "asc" }, { name: "asc" }],
  });

  const offerings = {
    hot: drinks.filter((drink) => drink.temperature === "HOT"),
    cold: drinks.filter((drink) => drink.temperature === "COLD"),
    other: drinks.filter((drink) => drink.temperature === "OTHER"),
  };

  res.status(200).json({
    offerings,
    summary: {
      hot: offerings.hot.length,
      cold: offerings.cold.length,
      other: offerings.other.length,
    },
  });
});
