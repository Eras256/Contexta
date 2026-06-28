# Contextio — Agentic Treasury & Payroll for LATAM on Stellar

> Non-custodial treasury & payroll where **AI agents** manage liquidity, yield, and
> payroll for companies paying teams in **Brazil, Argentina, and Colombia**.
> Treasury settles in digital dollars and XLM on **Stellar**, earns yield via
> **DeFindex** & **Blend**, on/off-ramps through **anchors + local rails**
> (PIX / Transferencias 3.0 / Bre-B), and binds every agentic action to a
> verifiable **Legal Context Protocol (LCP)** document. Users sign in with their
> **Stellar wallet** (Sign In With Stellar, SEP-53) — no passwords.

Built for a hackathon demo, architected for the **SCF Integration Track** and
production. Bootstrapped with the Stellar skill bundle for Soroban correctness;
all code in this monorepo is original.

## Live

| Surface | URL |
| :-- | :-- |
| Web app (Vercel) | **https://contexta-stellar.vercel.app** |
| API (Fly.io · region GRU) | **https://contexta-api.fly.dev** |
| Client SDK (npm) | **`contextio-sdk`** — `npm i contextio-sdk` |
| Soroban contracts (testnet) | treasury `CASGAQQVHDF4Q2XTK3QWYHRABYX7JUIO6HCLEOZZR7V3TIMVHMXPTA7I` · payroll `CDXML4PU5RVXQ7DSM7UO5OURKFUJMPGI57PRZCQ3NZTKFGPOIDIOIRCT` |

Connect Freighter (on **Testnet**) at the web app → sign the message → explore live treasury, agent, and payroll data.

---

## What's inside (monorepo)

```
contexta/
├─ apps/
│  ├─ web/         Next.js frontend — wallet sign-in, live API data + Supabase Realtime
│  ├─ api/         Express/TS backend (Fly.io) — wallet auth, treasury, payroll, LCP, integrations
│  └─ worker/      Agent loop + scheduled payroll (Fly.io)
├─ packages/
│  ├─ shared/      domain types, logger, Supabase + Stellar clients, LCP module
│  ├─ config/      type-safe env (zod) + RBAC capability matrix + security settings
│  ├─ tests/       fixtures + DeFindex/Blend mocks (built dep used by the API)
│  └─ sdk/         public client SDK published to npm as `contextio-sdk`
├─ contracts/
│  ├─ treasury/    Soroban (Rust): LCP-bound treasury flows
│  └─ payroll/     Soroban (Rust): idempotent, LCP-bound payroll runs
├─ supabase/       Postgres schema (migrations), RLS, seed, full_setup.sql
└─ .github/        CI (Node + Soroban + E2E)
```

A standout property: **the worker has no privileged path of its own**. The agent
acts through the API with `x-internal-secret` auth, so legal-context enforcement,
RBAC, and audit logging apply identically to agent and human actors.

## Architecture (flow)

```
Company Treasury (USDC · XLM · RWA)
        │  custody stays with the company
        ▼
Stellar wallet sign-in (SEP-53) ─▶ API (Fly.io) ─▶ Soroban contracts ─▶ DeFindex / Blend / Anchors
AI Agents ──▶ API / Worker ────────────┤                    │
                    ├── Supabase (accounts, payroll, audit, LCP refs) + Realtime
                    └── Legal Context Protocol binding on every agentic tx
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the Overview page diagram.

## Authentication — Sign In With Stellar (SEP-53)

No email/password. Users connect a Stellar wallet (**Freighter**, xBull, Albedo,
Lobstr, … via **Stellar Wallets Kit**) and sign a server challenge:

1. `POST /api/v1/auth/wallet/challenge` → a stateless, HMAC-signed, time-boxed message.
2. The wallet signs it (**SEP-53** message signing).
3. `POST /api/v1/auth/wallet/verify` → the API verifies the ed25519 signature over
   `SHA256("Stellar Signed Message:\n" + message)`, maps the address to a user,
   and mints a session **JWT (HS256)**.

That single JWT authenticates the API **and** authorizes Supabase Realtime/RLS
(`auth.uid() = sub`). The auth middleware also accepts asymmetric Supabase JWTs
via **JWKS** (ES256) for forward compatibility.

## The Legal Context Protocol (LCP)

Each tenant publishes a machine-readable terms document at
`https://{tenant-domain}/.well-known/legal-context.json` (terms, jurisdiction,
consent requirements, dispute channels, authorized settlement networks/assets).
The platform computes a **canonical SHA-256** of that document and binds the
hash into every agentic Stellar transaction (treasury flow / payroll run) and
audit record — so the legal basis of an action is independently verifiable.
Implementation: [`packages/shared/src/lcp`](packages/shared/src/lcp). The
**`contextio-sdk`** lets any client re-derive and verify that hash with
byte-for-byte parity.

## Client SDK (`contextio-sdk`)

```bash
npm i contextio-sdk
```

```ts
import { ContextioClient, signInWithStellar, hashLegalContext } from "contextio-sdk";
import { StellarWalletsKit, Networks, defaultModules } from "@creit.tech/stellar-wallets-kit";

const client = new ContextioClient({ baseUrl: "https://contexta-api.fly.dev" });
StellarWalletsKit.init({ network: Networks.TESTNET, modules: defaultModules() });
const { address } = await StellarWalletsKit.authModal();

const session = await signInWithStellar({
  client, address,
  signMessage: async (m) => (await StellarWalletsKit.signMessage(m, { address })).signedMessage,
});
const api = client.withSession(session);
const treasury = await api.treasury();
```

Isomorphic (browser + Node ≥ 18), ESM, zero server deps. Source: [`packages/sdk`](packages/sdk).

---

## Quickstart

Prerequisites: Node ≥ 20, pnpm ≥ 10, Rust (stable + `wasm32-unknown-unknown`),
and optionally the Supabase CLI and Stellar CLI.

```bash
pnpm install

# Build workspace packages first (apps depend on their d.ts):
pnpm --filter @contextio/config build
pnpm --filter @contextio/shared build
pnpm --filter @contextio/tests build

cp .env.example .env.local    # fill in values (works in mock mode with blanks)
```

`apps/api` / `apps/worker` `dev` scripts auto-load the repo-root `.env.local`
(`tsx --env-file-if-exists`); `apps/web` (Next.js) loads `apps/web/.env.local`
(public `NEXT_PUBLIC_*` only).

### Run locally

```bash
pnpm dev:web      # http://localhost:3000  (connect a wallet, or browse demo data)
pnpm dev:api      # http://localhost:8080  (REST API; mock integrations if keys unset)
pnpm dev:worker   # agent loop (needs the API running)
```

With no DeFindex/Blend credentials, those integrations run in **deterministic
mock mode** so the full stack works offline.

### Configure Supabase

1. Create a project (or `supabase start` locally).
2. Put `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_JWT_SECRET` in `.env.local`. The JWT secret is the project's
   **Legacy JWT Secret** (used to verify/mint HS256 session tokens).
3. Apply schema + seed (migrations `0001`–`0003`, RLS, seed):
   ```bash
   supabase db reset            # local
   # hosted: run supabase/full_setup.sql against the project (pooler connection)
   ```
See [supabase/README.md](supabase/README.md).

### Soroban contracts

```bash
cargo test --all                                   # unit tests (fast, native)
cargo build --release --target wasm32-unknown-unknown
# deploy + wire contract ids: see contracts/README.md
```
Already deployed on **testnet** (IDs in the Live table above); set
`TREASURY_CONTRACT_ID` / `PAYROLL_CONTRACT_ID` / `STELLAR_SERVICE_SECRET` to
settle on-chain instead of in simulation.

### Deploy

**API → Fly.io** (region GRU, single machine):
```bash
fly apps create contexta-api
fly secrets set SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
  SUPABASE_JWT_SECRET=... INTERNAL_API_SECRET=... STELLAR_SERVICE_SECRET=... \
  TREASURY_CONTRACT_ID=... PAYROLL_CONTRACT_ID=... CORS_ORIGINS=https://<your-web>.vercel.app
fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile --ha=false
```
Run `fly deploy` from the **repo root** so workspace packages resolve.

**Web → Vercel** (standalone from `apps/web`):
```bash
vercel deploy --prod --cwd apps/web --yes
# set NEXT_PUBLIC_API_URL / NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
#     / NEXT_PUBLIC_STELLAR_NETWORK on the Vercel project
```
After deploying the web, add its domain to the API's `CORS_ORIGINS`.

---

## Testing

```bash
pnpm lint          # eslint across all TS packages + next lint
pnpm typecheck     # tsc --noEmit across packages
pnpm test          # vitest (config, shared, api, worker, sdk) — 30+ tests
pnpm test:e2e      # Playwright E2E (web)
cargo test --all   # Soroban contract unit tests (11)
```

What's covered: LCP hashing/binding & money math (shared), env validation
(config), HTTP/auth/RBAC + agent planning + DeFindex/Blend integration (api),
scheduler (worker), SDK LCP parity (sdk), key UI flows (web E2E), and contract
logic incl. idempotency, auth, and balance invariants (Soroban). CI mirrors
these in [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Security posture

- **Non-custodial**: keys stay with the company; the service account only invokes
  authorized contract methods (multisig/smart-account in production).
- **Wallet auth**: Sign In With Stellar (SEP-53) — verified server-side; sessions
  are short-lived JWTs; the API also supports Supabase JWKS (ES256) verification.
- **RBAC**: declarative capability matrix in `@contextio/config`; enforced at the API.
- **Input validation**: zod on every state-changing endpoint.
- **Hardening**: helmet + explicit headers, CORS allowlist, per-route rate limits,
  body-size cap; secrets redacted in logs.
- **LCP gate**: agentic operations return **HTTP 412** unless a legal context is
  published and the action's required consents are satisfied.
- **RLS**: browser/anon Supabase access is tenant-scoped; the service-role key is
  server-only. Realtime subscriptions are RLS-authorized with the session JWT.

See [docs/SCF-INTEGRATION.md](docs/SCF-INTEGRATION.md) and
[apps/api/README.md](apps/api/README.md) for the API surface.

## Status & remaining work

Done: wallet sign-in, live web↔API wiring, Supabase Realtime, Soroban contracts
deployed on testnet, published client SDK, API on Fly + web on Vercel.

Clearly-bounded scaffolding (marked in code) rather than full implementations:

- **DeFindex/Blend live calls** fall back to deterministic mocks without API keys
  / contract IDs; the live request shapes are stubbed for swap-in.
- **Anchor SEP-24/31** on/off-ramps are represented per payroll line (UI + data
  model); wiring to specific LATAM anchors is a documented next step.
- **AI/LLM** is intentionally not embedded — the deterministic `AgentService.plan()`
  is the clean plug-in point for an external model.
- **On-chain settlement** records LCP-bound events + balances; moving actual SAC
  token value is the next contract milestone.

## Contributing

Contributions, issues, and reviews are welcome — whether you're a judge
evaluating the project or a developer extending it.

**Getting started**
1. Fork & clone, then follow [Quickstart](#quickstart) (`pnpm install` → build
   workspace packages → `cp .env.example .env.local`). Everything runs in
   deterministic mock mode with blank credentials, so you can review offline.
2. Create a feature branch: `git checkout -b feat/your-change`.

**Before opening a PR**, keep CI green:
```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
cargo fmt --all -- --check && cargo clippy --target wasm32-unknown-unknown -- -D warnings && cargo test --all
```

**Conventions**
- **TypeScript**: strict types (no `any`; prefer `unknown`); explicit `.js`
  extensions on relative imports in backend ESM packages; validate every
  state-changing HTTP body with `zod`; log via the structured `@contextio/shared`
  logger and redact secrets.
- **Architecture rules**: all agentic actions go through `apps/api`; the worker
  never writes on-chain/DB directly (it calls the API with `x-internal-secret`);
  treasury/payroll state-changers must carry a valid **LCP** binding (return
  **HTTP 412** otherwise); new Postgres tables get **RLS** policies.
- **Soroban**: persistent storage with `extend_ttl`; payroll idempotency on
  `run_id`; emitted events always include the canonical LCP SHA-256 hash.
- **Commits**: short, imperative messages; small, focused PRs; never commit
  secrets — `.env*` files are gitignored (see [.env.example](.env.example)).

**Security**: please report vulnerabilities privately to the maintainers rather
than opening a public issue.

## License

Licensed under the **Apache License 2.0** — see [LICENSE](LICENSE).

```
Copyright 2026 Contextio

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0
```
