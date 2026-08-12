-- ============================================================
-- OMAH KOEMPOEL — Migration 0001: Foundation Schema
-- Scope: extensions, business/tenant, RBAC, profiles, employees,
--        audit_logs, system_settings, generic audit trigger.
-- Run order: apply BEFORE 0002_rls_policies.sql
-- ============================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------
-- BUSINESS / TENANT (future multi-business ready, single row for now)
-- ----------------------------------------------------------
create table if not exists business (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_type text not null default 'cafe', -- cafe, restaurant, mart, laundry, carwash...
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into business (name, business_type)
values ('Omah Koempoel', 'cafe')
on conflict do nothing;

-- ----------------------------------------------------------
-- RBAC CORE
-- ----------------------------------------------------------
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  code text not null,              -- SUPER_ADMIN, OWNER, KASIR, FRONT_SERVE, ...
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  unique (business_id, code)
);

create table if not exists permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,       -- e.g. 'order.create', 'payroll.view', 'user.manage'
  module text not null,            -- e.g. 'order', 'finance', 'payroll'
  description text
);

create table if not exists role_permissions (
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- ----------------------------------------------------------
-- USERS / PROFILES (linked to Supabase auth.users)
-- ----------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references business(id),
  full_name text not null,
  phone text,
  avatar_url text,
  role_id uuid references roles(id),
  status text not null default 'active', -- active, suspended
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ----------------------------------------------------------
-- EMPLOYEES
-- ----------------------------------------------------------
create table if not exists employee_positions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  name text not null,             -- Owner, Manager, Kasir, Front Serve, Kitchen
  created_at timestamptz not null default now()
);

create table if not exists employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  profile_id uuid references profiles(id),
  employee_code text not null,
  position_id uuid references employee_positions(id),
  join_date date not null default current_date,
  status text not null default 'active', -- active, inactive, resigned
  basic_salary numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (business_id, employee_code)
);

-- ----------------------------------------------------------
-- SYSTEM SETTINGS (configuration over hardcoding)
-- ----------------------------------------------------------
create table if not exists system_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  key text not null,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id),
  unique (business_id, key)
);

-- ----------------------------------------------------------
-- AUDIT LOG (append-only, no update/delete allowed by app role)
-- ----------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  -- nullable: beberapa tabel yang diaudit (tabel junction/master global
  -- seperti role_permissions, permissions) tidak punya business_id sendiri
  business_id uuid references business(id),
  actor_id uuid references profiles(id),
  actor_role text,
  action text not null,           -- CREATE, UPDATE, VOID, REFUND, APPROVE, LOGIN, ...
  module text not null,           -- order, payment, payroll, user, tax, ...
  record_id uuid,
  old_value jsonb,
  new_value jsonb,
  reason text,
  ip_address text,
  created_at timestamptz not null default now()
);

-- Generic audit trigger function: any table using this trigger
-- automatically logs INSERT/UPDATE/DELETE into audit_logs.
create or replace function fn_audit_trigger()
returns trigger
language plpgsql
security definer
as $$
declare
  v_business_id uuid;
begin
  begin
    v_business_id := coalesce(NEW.business_id, OLD.business_id);
  exception when others then
    v_business_id := null;
  end;

  insert into audit_logs (business_id, actor_id, action, module, record_id, old_value, new_value)
  values (
    v_business_id,
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    coalesce((NEW.id)::uuid, (OLD.id)::uuid),
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
    case when TG_OP in ('UPDATE','INSERT') then to_jsonb(NEW) else null end
  );
  return coalesce(NEW, OLD);
end;
$$;

-- Attach audit trigger to sensitive foundation tables
drop trigger if exists trg_audit_roles on roles;
create trigger trg_audit_roles after insert or update or delete on roles
  for each row execute function fn_audit_trigger();

drop trigger if exists trg_audit_role_permissions on role_permissions;
create trigger trg_audit_role_permissions after insert or update or delete on role_permissions
  for each row execute function fn_audit_trigger();

drop trigger if exists trg_audit_profiles on profiles;
create trigger trg_audit_profiles after insert or update or delete on profiles
  for each row execute function fn_audit_trigger();

drop trigger if exists trg_audit_employees on employees;
create trigger trg_audit_employees after insert or update or delete on employees
  for each row execute function fn_audit_trigger();

drop trigger if exists trg_audit_system_settings on system_settings;
create trigger trg_audit_system_settings after insert or update or delete on system_settings
  for each row execute function fn_audit_trigger();
