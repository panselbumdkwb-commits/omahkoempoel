-- ============================================================
-- OMAH KOEMPOEL — Migration 0007: Employee Detail, Attendance, Payroll
-- ============================================================

-- Employee master data langsung di tabel employees (denormalized),
-- supaya Admin bisa input data pegawai TANPA wajib akun login dulu
-- (profile_id tetap nullable, dihubungkan belakangan kalau pegawai
-- butuh akses sistem).
alter table employees add column if not exists full_name text;
alter table employees add column if not exists phone text;
alter table employees add column if not exists address text;

-- ----------------------------------------------------------
-- ATTENDANCE
-- ----------------------------------------------------------
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  employee_id uuid not null references employees(id),
  attendance_date date not null default current_date,
  clock_in timestamptz,
  clock_out timestamptz,
  status text not null default 'present'
    check (status in ('present','late','absent','leave','early_leave')),
  notes text,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  unique (employee_id, attendance_date)
);

alter table attendance enable row level security;

create policy attendance_select on attendance for select
  using (
    business_id = fn_current_business_id()
    and (fn_current_role_code() in ('SUPER_ADMIN','OWNER')
         or employee_id in (select id from employees where profile_id = auth.uid()))
  );

create policy attendance_manage on attendance for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

drop trigger if exists trg_audit_attendance on attendance;
create trigger trg_audit_attendance after insert or update on attendance
  for each row execute function fn_audit_trigger();

-- ----------------------------------------------------------
-- PAYROLL — configurable components (Bagian 34 master prompt:
-- "Jangan hardcode formula. Gunakan configurable payroll rules.")
-- ----------------------------------------------------------
create table if not exists payroll_components (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  name text not null,                       -- "Tunjangan Makan", "BPJS JHT", dst
  component_type text not null check (component_type in ('earning','deduction')),
  calc_type text not null check (calc_type in ('fixed','percent_of_basic')),
  value numeric(14,4) not null,              -- rupiah (fixed) atau persen (percent_of_basic)
  cap_base numeric(14,2),                     -- batas upah dasar untuk persentase (mis. Rp10.547.400 utk JP)
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table payroll_components enable row level security;
create policy payroll_components_select on payroll_components for select
  using (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN','OWNER'));
create policy payroll_components_manage on payroll_components for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

drop trigger if exists trg_audit_payroll_components on payroll_components;
create trigger trg_audit_payroll_components after insert or update on payroll_components
  for each row execute function fn_audit_trigger();

-- ----------------------------------------------------------
-- PAYROLL — periods & items
-- ----------------------------------------------------------
create table if not exists payroll_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  period_start date not null,
  period_end date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','PAID')),
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

create table if not exists payroll_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  payroll_period_id uuid not null references payroll_periods(id),
  employee_id uuid not null references employees(id),
  basic_salary numeric(14,2) not null,
  earnings_breakdown jsonb not null default '[]',
  deductions_breakdown jsonb not null default '[]',
  gross_salary numeric(14,2) not null,
  total_deduction numeric(14,2) not null,
  net_salary numeric(14,2) not null,          -- take home pay
  status text not null default 'DRAFT' check (status in ('DRAFT','APPROVED','PAID')),
  created_at timestamptz not null default now(),
  unique (payroll_period_id, employee_id)
);

alter table payroll_periods enable row level security;
alter table payroll_items enable row level security;

create policy payroll_periods_rw on payroll_periods for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

create policy payroll_items_select on payroll_items for select
  using (
    fn_current_role_code() in ('SUPER_ADMIN','OWNER')
    or employee_id in (select id from employees where profile_id = auth.uid())
  );
create policy payroll_items_manage on payroll_items for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

drop trigger if exists trg_audit_payroll_periods on payroll_periods;
create trigger trg_audit_payroll_periods after insert or update on payroll_periods
  for each row execute function fn_audit_trigger();

drop trigger if exists trg_audit_payroll_items on payroll_items;
create trigger trg_audit_payroll_items after insert or update on payroll_items
  for each row execute function fn_audit_trigger();

-- ----------------------------------------------------------
-- SEED: komponen payroll default (semua BISA diubah/dinonaktifkan
-- oleh Owner/Super Admin lewat halaman Payroll Configuration).
-- Nilai BPJS berdasarkan ketentuan 2026: JHT 2% (karyawan, tanpa
-- batas), JP 1% (karyawan, upah maksimal Rp10.547.400/bulan).
-- WAJIB diverifikasi ulang ke bpjsketenagakerjaan.go.id secara
-- berkala karena regulasi dapat berubah.
-- ----------------------------------------------------------
do $$
declare
  v_business_id uuid;
begin
  select id into v_business_id from business where name = 'Omah Koempoel' limit 1;

  insert into payroll_components (business_id, name, component_type, calc_type, value, cap_base, sort_order) values
    (v_business_id, 'Tunjangan Makan', 'earning', 'fixed', 300000, null, 1),
    (v_business_id, 'Tunjangan Transport', 'earning', 'fixed', 200000, null, 2),
    (v_business_id, 'BPJS JHT (2%)', 'deduction', 'percent_of_basic', 2, null, 10),
    (v_business_id, 'BPJS JP (1%, maks Rp10.547.400)', 'deduction', 'percent_of_basic', 1, 10547400, 11)
  on conflict do nothing;
end $$;
