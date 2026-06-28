# Supabase (data layer)

Postgres schema, RLS policies, and seed data for Contexta.

```
migrations/
  0001_init.sql   tables, indexes, FKs, updated_at trigger
  0002_rls.sql    row-level security + role helpers
seed.sql          demo tenant (Acme LATAM) matching @contexta/tests fixtures
config.toml       local Supabase CLI config
```

## Tables

`tenants`, `users`, `tenant_users`, `legal_contexts`, `treasuries`,
`treasury_positions`, `payroll_employees`, `payroll_schedules`, `payroll_runs`,
`agent_decisions`, `consent_records`, `audit_logs`.

Base-unit monetary fields are `text` (exact bigint fidelity for 7-dp Stellar
base units); decimal salaries are `text`. JSON blobs (`document`, `payload`,
`lines`, `detail`, `country_limits_bps`) are `jsonb`.

## Local setup

```bash
supabase start          # Postgres + Auth on :54322 / :54321
supabase db reset       # apply migrations/* then seed.sql
```

## Hosted project

1. Create a project at supabase.com; copy the URL + anon + service-role keys into `.env`.
2. Apply migrations:
   ```bash
   supabase link --project-ref <ref>
   supabase db push        # pushes migrations/
   psql "$DATABASE_URL" -f seed.sql   # optional demo data
   ```

## Security model

- The **API/worker use the service-role key** and bypass RLS; every write is
  preceded by app-level auth + RBAC and recorded in `audit_logs`.
- The **browser/anon client respects RLS**: `is_tenant_member()` /
  `has_tenant_role()` restrict reads/writes to the caller's tenants.
- Never expose the service-role key to the frontend.
