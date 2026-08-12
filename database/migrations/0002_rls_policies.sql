-- ============================================================
-- OMAH KOEMPOEL — Migration 0002: RLS Policies (Foundation)
-- Enforces RBAC at the database layer, not just the UI.
-- Run AFTER 0001_foundation_schema.sql
-- ============================================================

-- Helper: get current user's role code from profiles/roles
create or replace function fn_current_role_code()
returns text
language sql
security definer
stable
as $$
  select r.code
  from profiles p
  join roles r on r.id = p.role_id
  where p.id = auth.uid()
  limit 1;
$$;

-- Helper: get current user's business_id
create or replace function fn_current_business_id()
returns uuid
language sql
security definer
stable
as $$
  select p.business_id from profiles p where p.id = auth.uid() limit 1;
$$;

-- ----------------------------------------------------------
-- Enable RLS on all foundation tables
-- ----------------------------------------------------------
alter table business enable row level security;
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table profiles enable row level security;
alter table employee_positions enable row level security;
alter table employees enable row level security;
alter table system_settings enable row level security;
alter table audit_logs enable row level security;

-- ----------------------------------------------------------
-- BUSINESS: readable by any authenticated user of that business
-- ----------------------------------------------------------
create policy business_select on business
  for select using (id = fn_current_business_id());

-- ----------------------------------------------------------
-- ROLES / PERMISSIONS / ROLE_PERMISSIONS: only SUPER_ADMIN can manage,
-- everyone in the business can read (needed for UI to render menus).
-- ----------------------------------------------------------
create policy roles_select on roles
  for select using (business_id = fn_current_business_id());

create policy roles_manage on roles
  for all using (fn_current_role_code() = 'SUPER_ADMIN')
  with check (fn_current_role_code() = 'SUPER_ADMIN');

create policy permissions_select on permissions
  for select using (true);

create policy permissions_manage on permissions
  for all using (fn_current_role_code() = 'SUPER_ADMIN')
  with check (fn_current_role_code() = 'SUPER_ADMIN');

create policy role_permissions_select on role_permissions
  for select using (true);

create policy role_permissions_manage on role_permissions
  for all using (fn_current_role_code() = 'SUPER_ADMIN')
  with check (fn_current_role_code() = 'SUPER_ADMIN');

-- ----------------------------------------------------------
-- PROFILES: user can read/update own profile; SUPER_ADMIN/OWNER can
-- read all profiles in their business; only SUPER_ADMIN can change roles.
-- ----------------------------------------------------------
create policy profiles_select_self on profiles
  for select using (id = auth.uid());

create policy profiles_select_admin on profiles
  for select using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER')
  );

create policy profiles_update_self on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role_id is not distinct from (select role_id from profiles where id = auth.uid()));

create policy profiles_manage_admin on profiles
  for all using (fn_current_role_code() = 'SUPER_ADMIN')
  with check (fn_current_role_code() = 'SUPER_ADMIN');

-- ----------------------------------------------------------
-- EMPLOYEES: SUPER_ADMIN/OWNER full access; employee can view own record only.
-- Payroll-related fields (basic_salary) are on this table, so kasir/front
-- serve get NO access at all — enforced by absence of a policy for them.
-- ----------------------------------------------------------
create policy employees_admin_full on employees
  for all using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER')
  )
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER')
  );

create policy employees_self_select on employees
  for select using (profile_id = auth.uid());

create policy employee_positions_select on employee_positions
  for select using (business_id = fn_current_business_id());

create policy employee_positions_manage on employee_positions
  for all using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

-- ----------------------------------------------------------
-- SYSTEM SETTINGS: readable by staff roles (needed for app config),
-- writable only by SUPER_ADMIN (or OWNER for a limited subset — handled
-- at service-layer whitelist, not here, since RLS can't easily restrict
-- by key without a lookup table; service layer enforces key-level rules).
-- ----------------------------------------------------------
create policy system_settings_select on system_settings
  for select using (business_id = fn_current_business_id());

create policy system_settings_manage on system_settings
  for all using (fn_current_role_code() = 'SUPER_ADMIN')
  with check (fn_current_role_code() = 'SUPER_ADMIN');

-- ----------------------------------------------------------
-- AUDIT LOGS: append-only. Only SUPER_ADMIN/OWNER can read.
-- No update/delete policy exists for ANYONE (including admins) —
-- this makes audit_logs effectively immutable via the API.
-- Inserts happen only via the SECURITY DEFINER trigger function.
-- ----------------------------------------------------------
create policy audit_logs_select on audit_logs
  for select using (
    fn_current_role_code() = 'SUPER_ADMIN'
    or (
      business_id = fn_current_business_id()
      and fn_current_role_code() = 'OWNER'
    )
  );

-- Note: intentionally no INSERT policy for regular clients — rows are
-- only created via fn_audit_trigger() running as SECURITY DEFINER.
-- Intentionally no UPDATE/DELETE policy at all — audit trail is immutable.
