import { Router } from "express";

import { posRouter } from "../modules/pos/pos.routes.js";
import { kitchenRouter } from "../modules/kitchen/kitchen.routes.js";
import { roomsRouter } from "../modules/rooms/rooms.routes.js";
import { receptionRouter } from "../modules/reception/reception.routes.js";
import { housekeepingRouter } from "../modules/housekeeping/housekeeping.routes.js";
import { storeRouter } from "../modules/store/store.routes.js";
import { productsRouter } from "../modules/products/products.routes.js";
import { menuRouter } from "../modules/menu/menu.routes.js";
import { usersRouter } from "../modules/users/users.routes.js";

export const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/pos", posRouter);
router.use("/kitchen", kitchenRouter);
router.use("/rooms", roomsRouter);
router.use("/reception", receptionRouter);
router.use("/housekeeping", housekeepingRouter);
router.use("/stores", storeRouter);
router.use("/products", productsRouter);
router.use("/menu", menuRouter);
router.use("/users", usersRouter);
