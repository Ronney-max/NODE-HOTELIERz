// Extends Express's Request type with the multi-tenant context
// attached by src/middleware/tenantContext.ts.
export {};

declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
      userId?: string;
    }
  }
}
