-- Demo seed data for Contexta. Mirrors @contexta/tests fixtures so the API,
-- worker, and UI tell the same story. Safe to run against a fresh local DB:
--   supabase db reset   (runs migrations then this seed)

-- Demo user (in a real project this id comes from auth.users after sign-up).
insert into public.users (id, email, full_name)
values ('00000000-0000-4000-8000-0000000000aa', 'owner@acme.example', 'Acme Owner')
on conflict (id) do nothing;

-- Tenant
insert into public.tenants (id, name, domain, country)
values ('00000000-0000-4000-8000-000000000001', 'Acme LATAM', 'acme.contexta.app', 'BR')
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
    "tenantDomain": "acme.contexta.app",
    "provider": {"legalName": "Acme Treasury Ltda", "jurisdiction": "BR", "contactEmail": "legal@acme.example"},
    "terms": {"url": "https://acme.contexta.app/legal/terms", "sha256": "0000000000000000000000000000000000000000000000000000000000000000", "effectiveDate": "2026-01-01"},
    "jurisdiction": "BR",
    "consentRequirements": [
      {"id": "treasury-management", "description": "Authorize agents to allocate idle treasury.", "required": true, "scope": ["treasury","yield"]},
      {"id": "payroll-execution", "description": "Authorize scheduled payroll settlement.", "required": true, "scope": ["payroll","offramp"]}
    ],
    "disputeChannels": [{"type": "arbitration", "provider": "Contexta default arbitration", "venue": "https://acme.contexta.app/legal/disputes", "governingLaw": "BR", "language": "en"}],
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
  ('00000000-0000-4000-8000-000000000030','00000000-0000-4000-8000-000000000001','Ana Souza','ana@acme.example','BR',null,'ana.souza@pix.example','BRL','PIX','4500.00'),
  ('00000000-0000-4000-8000-000000000031','00000000-0000-4000-8000-000000000001','Bruno Díaz','bruno@acme.example','AR','GBRUNOEXAMPLE',null,'USDC','STELLAR','3800.00'),
  ('00000000-0000-4000-8000-000000000032','00000000-0000-4000-8000-000000000001','Carolina Gómez','caro@acme.example','CO',null,'bre-b:caro.gomez','COP','BRE_B','3200.00')
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
