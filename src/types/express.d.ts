// Extends Express's Request type with the multi-tenant context
// attached by src/middleware/tenantContext.ts.
export {};

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      userId?: string;
      // Set by src/modules/platform/platform.auth.ts for /api/platform routes.
      platformAdmin?: { id: string; email: string; name: string };
    }
  }
}
