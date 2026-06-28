import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT } from "jose";
import { type Logger, stellar } from "@contexta/shared";
import type { ServerEnv } from "@contexta/config";
import type { Repository } from "../db/repository.js";

/**
 * Sign In With Stellar (SEP-53). The browser connects a wallet (Freighter, xBull,
 * Albedo, …) via Stellar Wallets Kit, signs a server-issued challenge message,
 * and we verify the ed25519 signature against the wallet's public key. On success
 * we map the address to a user, ensure tenant membership, and mint a session JWT.
 *
 * The JWT is HS256-signed with the Supabase JWT secret so the same token both:
 *   - authenticates API calls (the auth middleware's HS256 path), and
 *   - authorizes Supabase Realtime/RLS (auth.uid() = sub), no Supabase Auth login.
 *
 * Challenges are stateless: the server HMACs the message so a returned message is
 * provably one we issued, and embeds an expiry — no nonce store needed.
 */

const SEP53_PREFIX = "Stellar Signed Message:\n";

export interface Challenge {
  message: string;
  hmac: string;
}

export interface SessionResult {
  token: string;
  tokenType: "Bearer";
  expiresAt: string;
  address: string;
  userId: string;
  tenantId: string;
  role: string;
}

export class WalletAuthService {
  constructor(
    private readonly repo: Repository,
    private readonly config: ServerEnv,
    private readonly logger: Logger,
  ) {}

  /** Issue a signed, time-boxed challenge for a wallet address to sign. */
  buildChallenge(address: string): Challenge {
    assertStellarAddress(address);
    const nonce = randomBytes(16).toString("hex");
    const now = new Date();
    const expires = new Date(now.getTime() + 5 * 60_000);
    const message = [
      "Contexta — Sign in with Stellar",
      "",
      "Sign this message to authenticate. This does not move funds.",
      `Address: ${address}`,
      `Nonce: ${nonce}`,
      `Issued: ${now.toISOString()}`,
      `Expires: ${expires.toISOString()}`,
    ].join("\n");
    return { message, hmac: this.hmac(message) };
  }

  /** Verify a signed challenge and mint a session JWT. Throws on any failure. */
  async verify(input: {
    address: string;
    message: string;
    hmac: string;
    signedMessage: string;
  }): Promise<SessionResult> {
    assertStellarAddress(input.address);

    // 1. The message must be one we issued (HMAC) and not expired.
    if (!this.constantTimeEqualB64(this.hmac(input.message), input.hmac)) {
      throw new AuthError("Challenge not recognized");
    }
    const fields = parseChallenge(input.message);
    if (fields.address !== input.address) throw new AuthError("Address mismatch");
    if (!fields.expires || Date.parse(fields.expires) < Date.now()) {
      throw new AuthError("Challenge expired");
    }

    // 2. Verify the SEP-53 signature against the wallet's public key.
    if (!verifySep53(input.address, input.message, input.signedMessage)) {
      throw new AuthError("Invalid signature");
    }

    // 3. Map wallet -> user, resolve tenant membership.
    const user =
      (await this.repo.findUserByWallet(input.address)) ??
      (await this.repo.createWalletUser(input.address));

    let tenantId: string;
    let role: string;
    if (this.config.AUTH_DEMO_TENANT_ID) {
      tenantId = this.config.AUTH_DEMO_TENANT_ID;
      role = this.config.AUTH_DEMO_ROLE;
      await this.repo.ensureMembership(tenantId, user.id, role);
    } else {
      const m = await this.repo.firstMembershipForUser(user.id);
      if (!m) throw new AuthError("No workspace for this wallet");
      tenantId = m.tenantId;
      role = m.role;
    }

    // 4. Mint the session JWT (HS256 with the Supabase secret).
    const ttl = this.config.AUTH_SESSION_TTL_SECONDS;
    const secret = new TextEncoder().encode(this.config.SUPABASE_JWT_SECRET);
    const expSec = Math.floor(Date.now() / 1000) + ttl;
    const token = await new SignJWT({
      role: "authenticated",
      wallet_address: input.address,
      tenant_id: tenantId,
      app_role: role,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setSubject(user.id)
      .setIssuer(`${this.config.SUPABASE_URL}/auth/v1`)
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime(expSec)
      .sign(secret);

    this.logger.info({ address: redactAddr(input.address), tenantId, role }, "Wallet sign-in");
    return {
      token,
      tokenType: "Bearer",
      expiresAt: new Date(expSec * 1000).toISOString(),
      address: input.address,
      userId: user.id,
      tenantId,
      role,
    };
  }

  private hmac(message: string): string {
    return createHmac("sha256", this.config.SUPABASE_JWT_SECRET).update(message, "utf8").digest("base64");
  }

  private constantTimeEqualB64(a: string, b: string): boolean {
    const ba = Buffer.from(a, "base64");
    const bb = Buffer.from(b, "base64");
    return ba.length === bb.length && timingSafeEqual(ba, bb);
  }
}

export class AuthError extends Error {}

/** SEP-53: ed25519 verify over SHA-256(prefix || message). */
function verifySep53(address: string, message: string, signedMessage: string): boolean {
  const payload = Buffer.concat([Buffer.from(SEP53_PREFIX, "utf8"), Buffer.from(message, "utf8")]);
  const hash = createHash("sha256").update(payload).digest();
  const kp = stellar.Keypair.fromPublicKey(address);
  for (const enc of ["base64", "hex"] as const) {
    try {
      const sig = Buffer.from(signedMessage, enc);
      if (sig.length === 64 && kp.verify(hash, sig)) return true;
    } catch {
      /* try next encoding */
    }
  }
  return false;
}

function parseChallenge(message: string): { address?: string; expires?: string } {
  const get = (k: string) => message.match(new RegExp(`^${k}: (.+)$`, "m"))?.[1]?.trim();
  return { address: get("Address"), expires: get("Expires") };
}

function assertStellarAddress(a: string): void {
  if (!/^G[A-Z2-7]{55}$/u.test(a)) throw new AuthError("Invalid Stellar address");
}

function redactAddr(a: string): string {
  return `${a.slice(0, 5)}…${a.slice(-4)}`;
}
