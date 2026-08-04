import { Router } from "express";

import { posRouter } from "../modules/pos/pos.routes.js";
import { roomsRouter } from "../modules/rooms/rooms.routes.js";

export const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

router.use("/pos", posRouter);
router.use("/rooms", roomsRouter);
