-- Contexta — initial schema.
-- Postgres / Supabase. Base-unit monetary values are stored as text to preserve
-- exact bigint fidelity (7-dp Stellar base units), matching the API repository
-- which parses them via BigInt(). Decimal salary values are also text.

create extension if not exists "pgcrypto";

-- ── Reference check sets (kept as text + CHECK for flexible inserts) ──────────
-- role: owner|admin|member|viewer
-- country: BR|AR|CO
-- asset: USDC|XLM|CETES|BRL|ARS|COP
-- rail: PIX|TRANSFERENCIAS_3|BRE_B|STELLAR|SEP24|SEP31
-- strategy: liquidity|defindex_vault|blend_pool

-- ── tenants ──────────────────────────────────────────────────────────────────
create table if not exists public.tenants (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  domain            text not null unique,
  country           text not null check (country in ('BR','AR','CO')),
  legal_context_id  uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ── users (mirrors auth.users.id) ────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key,
  email       text not null unique,
  full_name   text,
  created_at  timestamptz not null default now()
);

-- ── tenant_users (membership + role) ─────────────────────────────────────────
create table if not exists public.tenant_users (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  role        text not null check (role in ('owner','admin','member','viewer')),
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);
create index if not exists idx_tenant_users_user on public.tenant_users(user_id);

-- ── legal_contexts (LCP documents, versioned) ────────────────────────────────
create table if not exists public.legal_contexts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  context_id    uuid not null,
  version       integer not null check (version > 0),
  document      jsonb not null,
  hash          text not null,
  published_at  timestamptz not null default now(),
  unique (tenant_id, version)
);
create index if not exists idx_legal_contexts_tenant on public.legal_contexts(tenant_id);
create index if not exists idx_legal_contexts_context on public.legal_contexts(context_id);

alter table public.tenants
  add constraint fk_tenants_legal_context
  foreign key (legal_context_id) references public.legal_contexts(context_id)
  deferrable initially deferred;

-- ── treasuries (one config per tenant) ───────────────────────────────────────
create table if not exists public.treasuries (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null unique references public.tenants(id) on delete cascade,
  min_liquidity_base_units  text not null default '0',
  max_yield_bps             integer not null default 0 check (max_yield_bps between 0 and 10000),
  country_limits_bps        jsonb not null default '{}'::jsonb,
  volatility_sensitivity    integer not null default 50 check (volatility_sensitivity between 0 and 100),
  updated_at                timestamptz not null default now()
);

-- ── treasury_positions ───────────────────────────────────────────────────────
create table if not exists public.treasury_positions (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  asset              text not null check (asset in ('USDC','XLM','CETES','BRL','ARS','COP')),
  strategy           text not null check (strategy in ('liquidity','defindex_vault','blend_pool')),
  strategy_ref       text,
  amount_base_units  text not null default '0',
  apy_bps            integer,
  updated_at         timestamptz not null default now()
);
create index if not exists idx_positions_tenant on public.treasury_positions(tenant_id);
create unique index if not exists uq_positions_bucket
  on public.treasury_positions(tenant_id, asset, strategy, coalesce(strategy_ref, ''));

-- ── payroll_employees ────────────────────────────────────────────────────────
create table if not exists public.payroll_employees (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  full_name       text not null,
  email           text,
  country         text not null check (country in ('BR','AR','CO')),
  wallet_address  text,
  bank_reference  text,
  payout_asset    text not null check (payout_asset in ('USDC','XLM','CETES','BRL','ARS','COP')),
  preferred_rail  text not null check (preferred_rail in ('PIX','TRANSFERENCIAS_3','BRE_B','STELLAR','SEP24','SEP31')),
  salary_amount   text not null default '0',
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists idx_employees_tenant on public.payroll_employees(tenant_id);

-- ── payroll_schedules ────────────────────────────────────────────────────────
create table if not exists public.payroll_schedules (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  cadence       text not null check (cadence in ('weekly','biweekly','monthly','one_off')),
  next_run_at   timestamptz not null,
  asset         text not null check (asset in ('USDC','XLM','CETES','BRL','ARS','COP')),
  rail          text not null check (rail in ('PIX','TRANSFERENCIAS_3','BRE_B','STELLAR','SEP24','SEP31')),
  employee_ids  uuid[] not null default '{}',
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists idx_schedules_tenant on public.payroll_schedules(tenant_id);
create index if not exists idx_schedules_due on public.payroll_schedules(next_run_at) where active;

-- ── payroll_runs ─────────────────────────────────────────────────────────────
create table if not exists public.payroll_runs (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  schedule_id         uuid references public.payroll_schedules(id) on delete set null,
  status              text not null check (status in ('scheduled','simulated','executing','completed','failed')),
  total_amount        text not null default '0',
  asset               text not null,
  lines               jsonb not null default '[]'::jsonb,
  legal_context_id    uuid,
  legal_context_hash  text,
  stellar_tx_hash     text,
  executed_at         timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_runs_tenant on public.payroll_runs(tenant_id, created_at desc);

-- ── agent_decisions ──────────────────────────────────────────────────────────
create table if not exists public.agent_decisions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  action              text not null,
  rationale           text not null default '',
  payload             jsonb not null default '{}'::jsonb,
  status              text not null check (status in ('proposed','approved','rejected','executed','failed')),
  legal_context_id    uuid,
  legal_context_hash  text,
  stellar_tx_hash     text,
  created_at          timestamptz not null default now(),
  decided_at          timestamptz
);
create index if not exists idx_decisions_tenant on public.agent_decisions(tenant_id, created_at desc);

-- ── consent_records (LCP acceptance) ─────────────────────────────────────────
create table if not exists public.consent_records (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  user_id       uuid references public.users(id) on delete set null,
  consent_id    text not null,
  accepted_at   timestamptz not null default now(),
  signature     text
);
create index if not exists idx_consents_tenant on public.consent_records(tenant_id);

-- ── audit_logs ───────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  actor_id          uuid,
  actor_type        text not null check (actor_type in ('user','agent','system')),
  action            text not null,
  detail            jsonb not null default '{}'::jsonb,
  legal_context_id  uuid,
  created_at        timestamptz not null default now()
);
create index if not exists idx_audit_tenant on public.audit_logs(tenant_id, created_at desc);

-- keep tenants.updated_at fresh
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_tenants_touch on public.tenants;
create trigger trg_tenants_touch before update on public.tenants
  for each row execute function public.touch_updated_at();
