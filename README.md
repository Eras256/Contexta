# Contexta — Agentic Treasury & Payroll for LATAM on Stellar

> Non-custodial treasury & payroll where **AI agents** manage liquidity, yield, and
> payroll for companies paying teams in **Brazil, Argentina, and Colombia**.
> Treasury settles in digital dollars and XLM on **Stellar**, earns yield via
> **DeFindex** & **Blend**, on/off-ramps through **anchors + local rails**
> (PIX / Transferencias 3.0 / Bre-B), and binds every agentic action to a
> verifiable **Legal Context Protocol (LCP)** document.

Built for a hackathon demo, architected for the **SCF Integration Track** and
production. Bootstrapped with the Stellar skill bundle (`stellar-build` /
`stellar-dev`) for Soroban correctness; all code in this monorepo is original.

---

## What's inside (monorepo)

```
contexta/
├─ apps/
│  ├─ web/         Next.js frontend — 7 sections (Overview…Docs & SCF)
│  ├─ api/         Express/TS backend (Fly.io) — auth, treasury, payroll, LCP, integrations
│  └─ worker/      Agent loop + scheduled payroll (Fly.io)
├─ packages/
│  ├─ shared/      domain types, logger, Supabase + Stellar clients, LCP module
│  ├─ config/      type-safe env (zod) + RBAC capability matrix + security settings
│  └─ tests/       fixtures + DeFindex/Blend mocks
├─ contracts/
│  ├─ treasury/    Soroban (Rust): LCP-bound treasury flows
│  └─ payroll/     Soroban (Rust): idempotent, LCP-bound payroll runs
├─ supabase/       Postgres schema (migrations), RLS, seed
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
AI Agents ──▶ API / Worker (Fly.io) ──▶ Soroban contracts ──▶ DeFindex / Blend / Anchors
                    │                          │
                    ├── Supabase (accounts, payroll, audit, LCP refs)
                    └── Legal Context Protocol binding on every agentic tx
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the Overview page diagram.

## The Legal Context Protocol (LCP)

Each tenant publishes a machine-readable terms document at
`https://{tenant-domain}/.well-known/legal-context.json` (terms, jurisdiction,
consent requirements, dispute channels, authorized settlement networks/assets).
The platform computes a **canonical SHA-256** of that document and binds the
hash into every agentic Stellar transaction (treasury flow / payroll run) and
audit record — so the legal basis of an action is independently verifiable.
Implementation: [`packages/shared/src/lcp`](packages/shared/src/lcp).

---

## Quickstart

Prerequisites: Node ≥ 20, pnpm ≥ 9, Rust (stable + `wasm32-unknown-unknown`),
and optionally the Supabase CLI and Stellar CLI.

```bash
pnpm install

# Build shared workspace packages first (apps depend on their d.ts):
pnpm --filter @contexta/config build
pnpm --filter @contexta/shared build

cp .env.example .env          # fill in values (works in mock mode with blanks)
```

### Run locally

```bash
pnpm dev:web      # http://localhost:3000  (runs standalone on demo data)
pnpm dev:api      # http://localhost:8080  (REST API; mock integrations if keys unset)
pnpm dev:worker   # agent loop (needs the API running)
```

With no DeFindex/Blend/Stellar credentials, integrations run in **deterministic
mock mode** so the full stack works offline — ideal for judging.

### Configure Supabase

1. Create a project (or `supabase start` locally).
2. Put `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_JWT_SECRET` in `.env`.
3. Apply schema + seed:
   ```bash
   supabase db reset            # local: migrations + seed.sql
   # or hosted: supabase db push  &&  psql "$DATABASE_URL" -f supabase/seed.sql
   ```
See [supabase/README.md](supabase/README.md).

### Soroban contracts

```bash
cargo test --all                                   # unit tests (fast, native)
cargo build --release --target wasm32-unknown-unknown
# deploy + wire contract ids: see contracts/README.md
```

### Deploy to Fly.io (region GRU — São Paulo)

```bash
# API
fly apps create contexta-api
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_JWT_SECRET=... \
  INTERNAL_API_SECRET=... STELLAR_SERVICE_SECRET=...
fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile

# Worker
fly apps create contexta-worker
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... INTERNAL_API_SECRET=...
fly deploy --config apps/worker/fly.toml --dockerfile apps/worker/Dockerfile
```
Run `fly deploy` from the **repo root** so workspace packages resolve in the
Docker build context.

---

## Testing

```bash
pnpm lint          # eslint across all TS packages + next lint
pnpm typecheck     # tsc --noEmit across packages
pnpm test          # vitest unit + integration (config, shared, api, worker)
pnpm test:e2e      # Playwright E2E (web, on demo data)
cargo test --all   # Soroban contract unit tests
```

What's covered: LCP hashing/binding & money math (shared), env validation
(config), HTTP/auth/RBAC + agent planning + DeFindex/Blend integration (api),
scheduler (worker), key UI flows (web E2E), and contract logic incl. idempotency,
auth, and balance invariants (Soroban). CI mirrors these in
[.github/workflows/ci.yml](.github/workflows/ci.yml).

## Security posture

- **Non-custodial**: keys stay with the company; the service account only invokes
  authorized contract methods (multisig/smart-account in production).
- **RBAC**: declarative capability matrix in `@contexta/config`; enforced at the API.
- **Input validation**: zod on every state-changing endpoint.
- **Hardening**: helmet + explicit headers, CORS allowlist, per-route rate limits,
  body-size cap; secrets redacted in logs.
- **LCP gate**: agentic operations return **HTTP 412** unless a legal context is
  published and the action's required consents are satisfied.
- **RLS**: browser/anon Supabase access is tenant-scoped; the service-role key is
  server-only.

See [docs/SCF-INTEGRATION.md](docs/SCF-INTEGRATION.md) for how this maps to the
SCF Integration Track, and [apps/api/README.md](apps/api/README.md) for the API surface.

## Environment limitations / TODOs

Clearly-bounded scaffolding (marked in code) rather than full implementations:

- **DeFindex/Blend live calls** fall back to deterministic mocks without API keys
  / contract IDs; the live request shapes are stubbed for swap-in.
- **Soroban settlement** runs in simulation (synthetic `sim:` tx hashes) until
  `TREASURY_CONTRACT_ID` / `PAYROLL_CONTRACT_ID` / `STELLAR_SERVICE_SECRET` are set.
- **Anchor SEP-24/31** on/off-ramps are represented per payroll line (UI + data
  model); wiring to specific LATAM anchors is a documented next step.
- **AI/LLM** is intentionally not embedded — the deterministic `AgentService.plan()`
  is the clean plug-in point for an external model.

## License

Apache-2.0.
