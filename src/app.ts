import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application } from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { tenantContext } from "./middleware/tenantContext.js";
import { router } from "./routes/index.js";

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  if (env.NODE_ENV === "development") {
    app.use(morgan("dev"));
  }

  app.use(express.json());
  app.use(cookieParser());
  app.use(tenantContext);

  app.use("/api", router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
