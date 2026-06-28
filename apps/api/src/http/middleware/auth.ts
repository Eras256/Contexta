import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { ServerEnv } from "@contexta/config";
import { HttpError, type AuthContext } from "../context.js";

/**
 * Authenticates a request in one of two ways:
 *
 *  1. End-user: `Authorization: Bearer <supabase-jwt>` verified with the
 *     Supabase JWT secret (HS256). Tenant comes from `x-tenant-id`; the role is
 *     resolved from `tenant_users` membership.
 *  2. Internal worker/agent: `x-internal-secret` equal to INTERNAL_API_SECRET.
 *     Acts as an `owner`-privileged agent for the supplied `x-tenant-id`.
 *
 * Unauthenticated requests are rejected before reaching any handler.
 */
export function authMiddleware(config: ServerEnv) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = req.header("x-tenant-id");
      const internalSecret = req.header("x-internal-secret");

      if (internalSecret) {
        if (internalSecret !== config.INTERNAL_API_SECRET) {
          throw new HttpError(401, "Invalid internal secret");
        }
        if (!tenantId) throw new HttpError(400, "x-tenant-id required for internal calls");
        req.ctx = { userId: null, email: null, tenantId, role: "owner", isAgent: true };
        return next();
      }

      const authz = req.header("authorization");
      if (!authz?.startsWith("Bearer ")) {
        throw new HttpError(401, "Missing bearer token");
      }
      const token = authz.slice("Bearer ".length);

      let payload: jwt.JwtPayload;
      try {
        payload = jwt.verify(token, config.SUPABASE_JWT_SECRET, {
          algorithms: ["HS256"],
        }) as jwt.JwtPayload;
      } catch {
        throw new HttpError(401, "Invalid or expired token");
      }

      const userId = typeof payload.sub === "string" ? payload.sub : null;
      if (!userId) throw new HttpError(401, "Token missing subject");
      if (!tenantId) throw new HttpError(400, "x-tenant-id header required");

      const membership = await req.container.repo.getMembership(tenantId, userId);
      if (!membership) throw new HttpError(403, "Not a member of this tenant");

      const ctx: AuthContext = {
        userId,
        email: typeof payload.email === "string" ? payload.email : null,
        tenantId,
        role: membership.role,
        isAgent: false,
      };
      req.ctx = ctx;
      next();
    } catch (e) {
      next(e);
    }
  };
}
