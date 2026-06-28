# @contextio/worker

Background workers for Contextio. A small in-process `Scheduler` runs three jobs
on an interval (`AGENT_POLL_INTERVAL_SECONDS`, default 300s):

| Job | What it does |
| --- | --- |
| `agent-rebalance` | For each active tenant, asks the agent to evaluate the treasury and (unless `AGENT_DRY_RUN`) execute the proposed rebalance. |
| `scheduled-payroll` | Triggers payroll runs whose `nextRunAt` is due. |
| `refresh-market-data` | Probes Stellar/Soroban reachability (hook for FX/yield snapshots). |

## Design

The worker holds **no business logic of its own** for agentic actions — it calls
the API (`apps/api`) using `x-internal-secret` auth. That keeps legal-context
enforcement, RBAC, and audit logging in exactly one place, and means the agent
is subject to the same guardrails as a human operator.

The plug-in point for a real AI/LLM is `AgentService.plan()` in the API. The
worker simply provides the cadence and the fan-out across tenants.

## Run locally

```bash
# Requires the API running on API_BASE_URL (default http://localhost:8080)
pnpm --filter @contextio/worker dev
pnpm --filter @contextio/worker test
```

## Deploy (Fly.io)

```bash
fly apps create contextio-agent
fly secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... INTERNAL_API_SECRET=...
fly deploy --config apps/worker/fly.toml --dockerfile apps/worker/Dockerfile
```

Keep `min`/`max` at a single machine — the in-process scheduler is not
distributed. For horizontal scale, move to a shared queue (e.g. pg-boss on the
Supabase Postgres) with leader election.
