// Creates (or re-activates) the first platform admin account — the TANZ
// staff login for the standalone platform admin app. Idempotent: re-running
// updates the name/password and re-activates, never duplicates.
//
// Credentials come from env (PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD
// / PLATFORM_ADMIN_NAME), falling back to a local-dev default so a fresh
// clone can sign in immediately. Set real values in .env before running
// this anywhere that matters.
import { prisma } from "../lib/prisma.js";
import { hashSecret } from "../lib/hash.js";
import { env } from "../config/env.js";

const email = env.PLATFORM_ADMIN_EMAIL ?? "admin@tanz.co";
const password = env.PLATFORM_ADMIN_PASSWORD ?? "changeme123";
const name = env.PLATFORM_ADMIN_NAME ?? "TANZ Admin";

const passwordHash = hashSecret(password);

const admin = await prisma.platformAdmin.upsert({
  where: { email },
  update: { name, password: passwordHash, isActive: true },
  create: { email, name, password: passwordHash },
});

console.log(`Platform admin ready: ${admin.email} (password: ${password})`);
await prisma.$disconnect();
