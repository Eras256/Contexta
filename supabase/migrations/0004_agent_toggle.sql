-- 0004_agent_toggle.sql
-- Per-tenant autonomous-agent switch — the dashboard activate/deactivate toggle.
-- The 24/7 worker's autonomous runs are suppressed when this is false; manual
-- agent runs (a signed-in user) are unaffected. Existing treasuries default to
-- enabled so current behaviour is preserved.

alter table public.treasuries
  add column if not exists agent_enabled boolean not null default true;
