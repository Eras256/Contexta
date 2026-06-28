import type { Request } from "express";
import type { Role } from "@contexta/shared";
import type { Container } from "../container.js";

/** Authenticated request context resolved by the auth middleware. */
export interface AuthContext {
  userId: string | null;
  email: string | null;
  tenantId: string;
  role: Role;
  /** True when the caller is the internal worker (agent), not an end user. */
  isAgent: boolean;
}

/**
 * Express's Request is augmented with `ctx` (auth) and `container` (DI) so
 * handlers stay thin and never import the composition root directly.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      ctx?: AuthContext;
      container: Container;
    }
  }
}

export function requireCtx(req: Request): AuthContext {
  if (!req.ctx) throw new HttpError(401, "Unauthenticated");
  return req.ctx;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
