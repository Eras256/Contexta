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
