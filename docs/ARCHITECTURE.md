# Architecture

Contextio is a non-custodial control plane: the company keeps custody, and AI
agents propose + execute treasury and payroll actions within signed limits, each
bound to a verifiable legal context.

## Components

| Component | Tech | Role |
| --- | --- | --- |
| `apps/web` | Next.js (App Router), Tailwind | Operator UI — treasury, payroll, agent, integrations, security, docs. |
| `apps/api` | Express, TypeScript | System of record API. Auth (Supabase JWT), RBAC, LCP enforcement, integrations, audit. |
| `apps/worker` | Node, TypeScript | Cadence for the agent loop + scheduled payroll; calls the API as the internal agent. |
| `packages/shared` | TypeScript | Domain types, logger, Supabase + Stellar clients, **LCP module**. |
| `packages/config` | TypeScript + zod | Type-safe env, RBAC capability matrix, security constants. |
| `contracts/treasury` | Rust / Soroban | Tamper-evident treasury flows; balance invariants; LCP-bound events. |
| `contracts/payroll` | Rust / Soroban | Idempotent payroll runs; agent/operator triggers; LCP-bound events. |
| Supabase | Postgres + Auth | Accounts, orgs, payroll, treasury config, audit, legal-context storage. |
| DeFindex / Blend | Stellar DeFi | RWA/CETES vault yield and lending-pool supply yield. |
| Anchors | SEP-24/31 | On/off-ramp digital dollars ↔ PIX / Transferencias 3.0 / Bre-B. |

## Request → settlement lifecycle (treasury rebalance)

1. **Plan** — `AgentService.plan()` reads the treasury snapshot, upcoming payroll
   obligations, and FX volatility; computes a single best action under the tenant's
   risk profile (liquidity floor, max-yield bps, country caps, volatility buffer).
2. **Bind** — `LegalContextService.bindForAction()` asserts a published legal
   context exists and the action's required consents are satisfied, returning an
   `LcpBinding { contextId, version, hash, consents }`. No binding ⇒ HTTP 412.
3. **Integrate** — DeFindex deposit/withdraw or Blend supply/withdraw (live or mock).
4. **Settle** — `SorobanGateway` invokes the treasury contract's `record_flow`,
   embedding the LCP hash in the emitted event.
5. **Persist + audit** — position balances updated in Supabase; an `audit_logs`
   row records actor, action, amounts, tx hash, and `legal_context_id`.

Payroll runs follow the same shape via `payroll.execute_run` (idempotent on the
off-chain run id).

## Trust boundaries

- **Browser** → only the Supabase anon client (RLS-scoped) and the API with a
  user JWT. Never holds the service-role key or Stellar secret.
- **API/Worker** → hold the service-role key and (optionally) the Stellar service
  secret. The worker authenticates to the API with `INTERNAL_API_SECRET`.
- **On-chain** → the service account is the contract admin; in production this
  should be a multisig or smart account with timelocked upgrades.

## Why route the agent through the API?

So that one code path enforces policy. The agent cannot bypass RBAC, the LCP
gate, or audit logging, because it has no direct write access to Supabase or the
contracts for agentic actions — it calls the same endpoints a human admin does.
