import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 moved the connection URL out of schema.prisma and into this
// config file. This is used by the Prisma CLI (generate, migrate, studio).
// The running app itself connects via a driver adapter — see src/lib/prisma.ts.
//
// `process.env.DATABASE_URL` (rather than the strict `env()` helper) is used
// deliberately so `prisma generate` keeps working in environments with no
// `.env` yet (e.g. fresh scaffolding, CI type-checking) — it only needs the
// schema, not a reachable database. `prisma migrate`/`studio` still need a
// real, reachable DATABASE_URL in `.env`.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/hotelier?schema=public",
  },
});
