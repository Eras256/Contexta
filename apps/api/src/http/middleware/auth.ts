import type { NextFunction, Request, Response } from "express";
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";
import type { ServerEnv } from "@contextio/config";
import { HttpError, type AuthContext } from "../context.js";

/**
 * Authenticates a request in one of two ways:
 *
 *  1. End-user: `Authorization: Bearer <supabase-jwt>`. Supabase projects that
 *     have migrated to asymmetric JWT signing issue ES256/RS256 access tokens
 *     verified against the project JWKS; older/legacy tokens (and the static
 *     anon/service_role keys) are HS256, verified with the legacy JWT secret.
 *     We try the JWKS first and fall back to HS256. Tenant comes from
 *     `x-tenant-id`; the role is resolved from `tenant_users` membership.
 *  2. Internal worker/agent: `x-internal-secret` equal to INTERNAL_API_SECRET.
 *     Acts as an `owner`-privileged agent for the supplied `x-tenant-id`.
 *
 * Unauthenticated requests are rejected before reaching any handler.
 */

// Cache one remote JWKS per Supabase URL (jose caches keys + refetches on new kid).
const jwksByUrl = new Map<string, JWTVerifyGetKey>();
function getJwks(supabaseUrl: string): JWTVerifyGetKey {
  let jwks = jwksByUrl.get(supabaseUrl);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    jwksByUrl.set(supabaseUrl, jwks);
  }
  return jwks;
}

/**
 * Verify a Supabase access token. HS256 tokens (legacy secret, anon/service_role
 * keys, test fixtures) are checked against the shared secret; asymmetric tokens
 * (ES256/RS256 from projects on the new JWT signing keys) against the JWKS.
 */
async function verifySupabaseToken(token: string, config: ServerEnv): Promise<JWTPayload> {
  const { alg } = decodeProtectedHeader(token);
  if (alg === "HS256") {
    const secret = new TextEncoder().encode(config.SUPABASE_JWT_SECRET);
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload;
  }
  const { payload } = await jwtVerify(token, getJwks(config.SUPABASE_URL), {
    issuer: `${config.SUPABASE_URL}/auth/v1`,
    audience: "authenticated",
  });
  return payload;
}

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

      let payload: JWTPayload;
      try {
        payload = await verifySupabaseToken(token, config);
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
