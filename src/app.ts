import path from "node:path";
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
      // In production every tenant is served from its own subdomain
      // (<slug>.{APP_DOMAIN}), so the allowed origin can't be a single
      // fixed string — it's CORS_ORIGIN (dev) or any host under APP_DOMAIN.
      origin(origin, callback) {
        if (!origin) { callback(null, true); return; } // non-browser clients (curl, health checks)
        if (origin === env.CORS_ORIGIN) { callback(null, true); return; }
        if (env.APP_DOMAIN) {
          const host = new URL(origin).hostname;
          if (host === env.APP_DOMAIN || host.endsWith(`.${env.APP_DOMAIN}`)) { callback(null, true); return; }
        }
        callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    })
  );

  if (env.NODE_ENV === "development") {
    app.use(morgan("dev"));
  }

  app.use(express.json());
  app.use(cookieParser());

  // Scoped CORP relaxation: the global helmet() above defaults to
  // Cross-Origin-Resource-Policy: same-origin, which would silently block
  // <img src> loading an uploaded logo when the frontend is served from a
  // different origin/subdomain than the API (true even in dev: :5173 vs
  // :4000). This second helmet() call only changes that one header, only
  // for /uploads responses — every other route keeps the strict default.
  app.use(
    "/uploads",
    helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }),
    express.static(path.resolve(process.cwd(), "uploads"), { immutable: true, maxAge: "365d" })
  );

  app.use(tenantContext);

  app.use("/api", router);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
