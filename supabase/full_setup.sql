-- ============================================================================
-- Contextio — FULL Supabase setup (single file). Idempotent: safe to re-run.
-- Paste into the Supabase SQL Editor (or psql). Order: schema → RLS → seed.
-- Generated 2026-06-28T02:36:45Z from migrations 0001+0002+seed.
-- NOTE: on a project that already has a DIFFERENT 'audit_logs' table, drop it
--       first (it must have a tenant_id column for Contextio).
-- ============================================================================

-- ████ 1/3 SCHEMA (0001_init.sql) ███████████████████████████████████████████
-- Contextio — initial schema.
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

-- tenants.legal_context_id is a SOFT reference to legal_contexts.context_id.
-- It cannot be a real FK: context_id is intentionally non-unique (one logical
-- context has many versioned rows, keyed unique by (tenant_id, version)), and a
-- FK target must be unique/PK. This matches how payroll_runs / agent_decisions /
-- audit_logs also store legal_context_id as a plain uuid without a FK.

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

-- ████ 2/3 ROW LEVEL SECURITY (0002_rls.sql) ████████████████████████████████
-- Row Level Security. The backend uses the service-role key (bypasses RLS) for
-- privileged, audited writes. These policies protect direct access from the
-- browser anon/auth client: a user may only read rows for tenants they belong to.

-- Helper: is the current auth user a member of the given tenant?
create or replace function public.is_tenant_member(t uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_users tu
    where tu.tenant_id = t and tu.user_id = auth.uid()
  );
$$;

-- Helper: does the current user hold at least the given role on the tenant?
create or replace function public.has_tenant_role(t uuid, min_role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tenant_users tu
    where tu.tenant_id = t
      and tu.user_id = auth.uid()
      and case tu.role
            when 'owner'  then 3
            when 'admin'  then 2
            when 'member' then 1
            else 0
          end
        >=
          case min_role
            when 'owner'  then 3
            when 'admin'  then 2
            when 'member' then 1
            else 0
          end
  );
$$;

do $$
declare tbl text;
begin
  foreach tbl in array array[
    'tenants','users','tenant_users','legal_contexts','treasuries',
    'treasury_positions','payroll_employees','payroll_schedules','payroll_runs',
    'agent_decisions','consent_records','audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security;', tbl);
  end loop;
end $$;

-- tenants: members can read their tenant.
drop policy if exists tenants_read on public.tenants;
create policy tenants_read on public.tenants
  for select using (public.is_tenant_member(id));

-- users: a user can read their own row.
drop policy if exists users_self on public.users;
create policy users_self on public.users
  for select using (id = auth.uid());

-- tenant_users: members can see co-members of their tenants.
drop policy if exists tenant_users_read on public.tenant_users;
create policy tenant_users_read on public.tenant_users
  for select using (public.is_tenant_member(tenant_id));

-- Generic tenant-scoped read for the rest.
do $$
declare tbl text;
begin
  foreach tbl in array array[
    'legal_contexts','treasuries','treasury_positions','payroll_employees',
    'payroll_schedules','payroll_runs','agent_decisions','consent_records','audit_logs'
  ]
  loop
    execute format('drop policy if exists %I_read on public.%I;', tbl, tbl);
    execute format(
      'create policy %I_read on public.%I for select using (public.is_tenant_member(tenant_id));',
      tbl, tbl
    );
  end loop;
end $$;

-- Admin+ may insert/update employees & schedules directly (optional convenience;
-- the API still mediates most writes via the service role).
drop policy if exists employees_write on public.payroll_employees;
create policy employees_write on public.payroll_employees
  for all
  using (public.has_tenant_role(tenant_id, 'admin'))
  with check (public.has_tenant_role(tenant_id, 'admin'));

drop policy if exists schedules_write on public.payroll_schedules;
create policy schedules_write on public.payroll_schedules
  for all
  using (public.has_tenant_role(tenant_id, 'admin'))
  with check (public.has_tenant_role(tenant_id, 'admin'));

-- ████ 3/3 SEED DATA (seed.sql) — demo tenant/employees; skip if not wanted ██
-- Demo seed data for Contextio. Mirrors @contextio/tests fixtures so the API,
-- worker, and UI tell the same story. Safe to run against a fresh local DB:
--   supabase db reset   (runs migrations then this seed)

-- Demo user (in a real project this id comes from auth.users after sign-up).
insert into public.users (id, email, full_name)
values ('00000000-0000-4000-8000-0000000000aa', 'owner@acme.example', 'Acme Owner')
on conflict (id) do nothing;

-- Tenant
insert into public.tenants (id, name, domain, country)
values ('00000000-0000-4000-8000-000000000001', 'Contextio', 'contextio.xyz', 'BR')
on conflict (id) do nothing;

insert into public.tenant_users (tenant_id, user_id, role)
values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000aa', 'owner')
on conflict do nothing;

-- Legal context (v1) + link tenant.legal_context_id
insert into public.legal_contexts (id, tenant_id, context_id, version, hash, document)
values (
  '00000000-0000-4000-8000-0000000000c1',
  '00000000-0000-4000-8000-000000000001',
  '11111111-1111-4111-8111-111111111111',
  1,
  'b3f1c0a9d2e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
  '{
    "specVersion": "0.1.0",
    "contextId": "11111111-1111-4111-8111-111111111111",
    "version": 1,
    "tenantDomain": "contextio.xyz",
    "provider": {"legalName": "Acme Treasury Ltda", "jurisdiction": "BR, AR, CO", "contactEmail": "legal@contextio.xyz"},
    "terms": {"url": "https://contextio.xyz/legal/terms", "sha256": "0000000000000000000000000000000000000000000000000000000000000000", "effectiveDate": "2026-01-01"},
    "jurisdictions": ["BR", "AR", "CO"],
    "consentRequirements": [
      {"id": "treasury-management", "description": "Authorize agents to allocate idle treasury.", "required": true, "scope": ["treasury","yield"]},
      {"id": "payroll-execution", "description": "Authorize scheduled payroll settlement.", "required": true, "scope": ["payroll","offramp"]}
    ],
    "disputeChannels": [{"type": "arbitration", "provider": "Contextio default arbitration", "venue": "https://contextio.xyz/legal/disputes", "governingLaw": "BR", "language": "en"}],
    "settlement": {"networks": ["stellar:testnet","stellar:pubnet"], "assets": ["USDC","XLM"]},
    "publishedAt": "2026-01-04T10:02:00.000Z"
  }'::jsonb
)
on conflict (tenant_id, version) do nothing;

update public.tenants
  set legal_context_id = '11111111-1111-4111-8111-111111111111'
  where id = '00000000-0000-4000-8000-000000000001';

-- Treasury config
insert into public.treasuries (tenant_id, min_liquidity_base_units, max_yield_bps, country_limits_bps, volatility_sensitivity)
values ('00000000-0000-4000-8000-000000000001', '500000000000', 6000, '{"BR":5000,"AR":3000,"CO":3000}', 60)
on conflict (tenant_id) do nothing;

-- Positions
insert into public.treasury_positions (tenant_id, asset, strategy, strategy_ref, amount_base_units, apy_bps) values
  ('00000000-0000-4000-8000-000000000001', 'USDC',  'liquidity',      null,                  '800000000000', null),
  ('00000000-0000-4000-8000-000000000001', 'XLM',   'liquidity',      null,                  '150000000000', null),
  ('00000000-0000-4000-8000-000000000001', 'CETES', 'defindex_vault', 'vault_cetes_rwa_001', '1200000000000', 1075),
  ('00000000-0000-4000-8000-000000000001', 'USDC',  'blend_pool',     'blend_pool_main',     '300000000000', 540)
on conflict do nothing;

-- Employees
insert into public.payroll_employees (id, tenant_id, full_name, email, country, wallet_address, bank_reference, payout_asset, preferred_rail, salary_amount) values
  ('00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000001','Ana Souza','ana@acme.example','BR','GA6NLHV2M4DEYN6W4EFAL5Y2SBN4VRURLXYVWUGB4GOZFNA3DGVACD37','ana.souza@pix.example','USDC','PIX','4500.00'),
  ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000001','Bruno Díaz','bruno@acme.example','AR','GAA7WTDM5U654ANX7EUFPEVZIPVDZUVTLZCK4ZVMFQMB4AS3NNOR44QU',null,'USDC','STELLAR','3800.00'),
  ('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000001','Carolina Gómez','caro@acme.example','CO','GC6HMXXYURNXEFU5K75JQM25CQQ3HP2XSXSNRAMFK4GJRZDCEZVXEMUY','bre-b:caro.gomez','USDC','BRE_B','3200.00')
on conflict (id) do nothing;

-- Schedule
insert into public.payroll_schedules (id, tenant_id, name, cadence, next_run_at, asset, rail, employee_ids) values
  ('00000000-0000-4000-8000-000000000040','00000000-0000-4000-8000-000000000001','Monthly LATAM payroll','monthly','2026-07-01T12:00:00Z','USDC','STELLAR',
   array['00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000032']::uuid[])
on conflict (id) do nothing;

-- Consents
insert into public.consent_records (tenant_id, user_id, consent_id, signature) values
  ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000aa','treasury-management','G7K2EXAMPLE9f1a'),
  ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-0000000000aa','payroll-execution','G7K2EXAMPLE9f1a')
on conflict do nothing;
