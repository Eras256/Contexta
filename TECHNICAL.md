# Contextio — Technical Architecture & Stellar Integration Plan

> Autonomous, non-custodial treasury & payroll for emerging-market businesses, built on **Stellar / Soroban**. This document describes the live architecture, the Stellar building blocks we integrate, and the concrete plan to harden them and launch on **mainnet**.

- **Live app:** https://www.contextio.xyz
- **API + 24/7 agent:** https://contextio-api.fly.dev
- **Repo:** https://github.com/Eras256/Contextio
- **Demo:** https://youtu.be/JI7KpNQMo0A

---

## 1. Overview

Contextio is an AI agent that runs **treasury** and **payroll** on Stellar. It keeps enough USDC liquid for payday, puts idle cash to work earning real yield (Blend, DeFindex), prices assets with an on-chain oracle (Reflector), and pays teams across borders — **non-custodial**, with every action bound to owner-signed rules and verifiable on-chain (our Legal Context Protocol). The on-chain **decision is deterministic and auditable**; an LLM only writes the human-readable rationale.

## 2. System architecture

```
        ┌──────────── User (company owner) ────────────┐
        │  Stellar wallet (Freighter via Wallets Kit)   │
        └───────────────┬───────────────────────────────┘
        Sign In With Stellar (SEP-53)  ·  self-custody signing
                        ▼
   ┌──────────────────── API (Fly.io / Express) ────────────────────┐
   │  Auth (SEP-10/53) · RBAC · Legal Context Protocol (LCP) gate    │
   │  Treasury · Payroll · Agent · Integrations                      │
   └───┬───────────┬───────────┬───────────┬───────────┬────────────┘
       ▼           ▼           ▼           ▼           ▼
   Soroban     Blend       DeFindex    Reflector   SEP-24 anchor
   contracts  (lending)    (vaults)    (oracle)    (off-ramp)
   (treasury,                                       PIX/Bre-B (prod)
    payroll)
       │
       ▼
   Supabase (Postgres) — accounts/payroll/audit/LCP refs · RLS · Realtime
       ▲
   24/7 Agent (Fly.io) — calls the API with an internal secret; it has
   **no privileged on-chain path of its own**, so LCP + RBAC + audit apply
   identically to agent and human actors.
```

**Read path:** the dashboard reads **live on-chain state** — wallet balances (Horizon), Blend/DeFindex positions, and Reflector prices via read-only Soroban simulation — aggregated into a USD snapshot (12s TTL cache).
**Write path:** treasury moves are built as unsigned XDR, **signed by the user in Freighter**, and submitted via Soroban RPC; agent/payroll actions are signed by a delegated operational key, always bound to a published LCP document.

## 3. Stellar integrations — live today (testnet)

| Building block | How Contextio uses it | Status |
|---|---|---|
| **Soroban smart contracts** | Treasury + payroll contracts; idempotent, event-driven; every event carries the LCP SHA-256 hash. | ✅ Deployed |
| **Blend** (`PoolContractV2`) | Real USDC lending of idle treasury cash; positions read live. | ✅ Live |
| **DeFindex** | Real XLM yield vaults; users deploy their own via the factory, Freighter-signed (self-custody). | ✅ Live |
| **Reflector** (SEP-40 oracle) | Real on-chain XLM/USD priced via read-only Soroban simulation → drives the treasury's USD valuation (replaces a hardcoded rate). Proof: `GET /api/v1/public/oracle`. | ✅ Live |
| **SEP-10 / SEP-53** | SEP-53 for wallet sign-in **and** agent-authorization consent; SEP-10 challenge/verify for the anchor. | ✅ Live |
| **SEP-24** | Interactive anchor off-ramp (USDC/XLM) against a testnet anchor. | ✅ Live |
| **Horizon** | Batch payments — real USDC payroll to employee wallets in one tx. | ✅ Live |
| **Stellar Wallets Kit** | Freighter/xBull/Albedo/Lobstr connection + self-custody signing. | ✅ Live |
| **USDC** | Circle testnet USDC for payroll; positions read on-chain. | ✅ Live |

**Verifiable example:** USDC payroll settled to 3 employees — tx `4bd1b927df7ab404dcd56abe649dcd47f56aa174b8116c747ec4f1aabc12cf78`.

## 4. Security & trust model

- **Non-custodial:** keys stay with the company. The user signs treasury moves in Freighter; the agent uses a delegated operational key bounded by signed rules.
- **"LLM proposes, the contract decides":** the deterministic risk engine chooses the action + amount; the LLM only explains it. Funds are never moved by the model.
- **Legal Context Protocol (LCP):** every agentic action is bound to a hashed, multi-jurisdiction terms document at `/.well-known/legal-context.json`; the canonical SHA-256 is written into every treasury flow, payroll run, and audit record — independently verifiable (re-derivable via `contextio-sdk`). State-changing endpoints return **HTTP 412** without a valid LCP binding.
- **RBAC + zod validation** on every state-changing endpoint; **RLS** on all tenant data; **helmet**, CORS allowlist, rate limits; secrets redacted in logs.

## 5. Deployed contracts (testnet)

- Treasury: `CASGAQQVHDF4Q2XTK3QWYHRABYX7JUIO6HCLEOZZR7V3TIMVHMXPTA7I`
- Payroll: `CDXML4PU5RVXQ7DSM7UO5OURKFUJMPGI57PRZCQ3NZTKFGPOIDIOIRCT`
- Reflector oracle (external, base USD): `CCYOZJCOPG34LLQQ7N24YXBM7LL62R7ONMZ3G6WZAAYPB5OYKOMJRN63`

## 6. Integration roadmap — building blocks → mainnet (4 months)

**Building blocks (Integration List):** Soroban · **Blend** · **DeFindex** · **Reflector** · **SEP-24 anchor** · Stellar Wallets Kit.

### Milestone 1 — Unified treasury + oracle hardening *(Tranche #1)*
- Unify the per-integration service accounts into a single **smart-account treasury**, so liquidity, **Blend** lending, and **DeFindex** vault positions are held and controlled by one account with multisig/policy auth.
- Expand **Reflector** to feed FX pairs into the agent's risk/buffer engine (not just XLM/USD valuation).
- *Done when:* smart-account treasury live on testnet; agent rebalances Blend/DeFindex from the unified account using real Reflector prices.

### Milestone 2 — Real off-ramp + multi-entity *(Tranche #2)*
- Integrate a **licensed SEP-24/31 anchor** for a real off-ramp corridor (USDC → local currency), bridging to local rails (PIX / Bre-B / mobile money) in target markets.
- Multi-entity treasury + KYC/KYB onboarding.
- *Done when:* a real off-ramp transaction settles via the anchor; ≥1 multi-entity tenant live with KYB.

### Milestone 3 — Mainnet launch *(Tranche #3)*
- Deploy treasury + payroll Soroban contracts to **mainnet**; onboard the first pilot customer settling real value; professional user testing.
- *Done when:* contracts live on mainnet; ≥1 pilot moving real USDC payroll + treasury on mainnet.

*(Budget excludes marketing and security-audit costs, per SCF rules; audit credits are applied at Tranche #3.)*

## 7. Tech stack

Stellar · Soroban (Rust) · `@stellar/stellar-sdk` v16 (Protocol 23) · Stellar Wallets Kit · Reflector (SEP-40) · Next.js · TypeScript · Express · Supabase (Postgres/Auth/Realtime) · Fly.io · Vercel. Open SDK: `contextio-sdk` (npm).

## 8. Links

Web https://www.contextio.xyz · API https://contextio-api.fly.dev · Repo https://github.com/Eras256/Contextio · Demo https://youtu.be/JI7KpNQMo0A · SDK https://www.npmjs.com/package/contextio-sdk
