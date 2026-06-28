/**
 * Centralized security posture shared by API and worker. Keeping these values
 * here (rather than scattered across middleware) makes the platform's security
 * stance auditable in one place — relevant for the SCF Integration Track review.
 */

export const ROLES = ["owner", "admin", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

/** Role hierarchy: higher index = more privilege. */
const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export function roleAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * Capability matrix. Each capability maps to the minimum role that may perform
 * it. Treasury moves and payroll execution require admin+; reads allow viewer.
 */
export const CAPABILITIES = {
  "tenant.read": "viewer",
  "tenant.manage": "owner",
  "treasury.read": "viewer",
  "treasury.configure": "admin",
  "treasury.rebalance": "admin",
  "payroll.read": "viewer",
  "payroll.manage": "admin",
  "payroll.execute": "admin",
  "legal.read": "viewer",
  "legal.publish": "owner",
  "agent.read": "viewer",
  "agent.configure": "admin",
  "integrations.manage": "admin",
  "audit.read": "admin",
} as const satisfies Record<string, Role>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: Role, capability: Capability): boolean {
  return roleAtLeast(role, CAPABILITIES[capability]);
}

/** Security headers applied to every API response (helmet-compatible). */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
} as const;

export const RATE_LIMIT = {
  /** Default window for general API endpoints. */
  windowMs: 60_000,
  max: 120,
  /** Tighter limit for state-changing agentic / treasury endpoints. */
  sensitive: {
    windowMs: 60_000,
    max: 20,
  },
} as const;

/**
 * Body size limits. Treasury/payroll payloads are small; reject large bodies
 * early to blunt trivial DoS attempts.
 */
export const MAX_JSON_BODY_BYTES = 256 * 1024;
