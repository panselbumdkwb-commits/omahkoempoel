-- ============================================================
-- OMAH KOEMPOEL — Migration 0012: Gaji Pokok per Jabatan,
-- Pegawai Casual (upah harian pengganti), & Biaya Operasional Bulanan
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

-- ----------------------------------------------------------
-- A. GAJI POKOK PER JABATAN — sebelumnya basic_salary cuma diisi
--    manual per-pegawai tanpa acuan, jadi 2 orang dengan jabatan sama
--    bisa beda gaji pokok tanpa sengaja. Sekarang tiap jabatan (di
--    employee_positions) punya default_basic_salary sebagai acuan;
--    Admin tetap BISA override basic_salary per pegawai kalau perlu
--    (mis. senioritas/negosiasi khusus), tapi form Tambah Pegawai akan
--    auto-isi dari jabatan yang dipilih.
-- ----------------------------------------------------------
alter table employee_positions add column if not exists default_basic_salary numeric(14,2) not null default 0;

comment on column employee_positions.default_basic_salary is
  'Acuan gaji pokok bulanan untuk jabatan ini (Rp). Dipakai untuk auto-isi form Tambah Pegawai; basic_salary per pegawai tetap bisa diedit manual.';

do $$
declare
  v_business_id uuid;
begin
  select id into v_business_id from business where name = 'Omah Koempoel' limit 1;
  if v_business_id is null then
    return;
  end if;

  insert into employee_positions (business_id, name, default_basic_salary)
  select v_business_id, x.name, x.salary
  from (values
    ('Captain', 2300000),
    ('Chef', 2100000),
    ('Cashier', 1900000),
    ('Bar', 2000000),
    ('Waitress', 1750000),
    ('Security', 1500000),
    ('Team Creative', 2400000)
  ) as x(name, salary)
  where not exists (
    select 1 from employee_positions p where p.business_id = v_business_id and lower(p.name) = lower(x.name)
  );

  -- Kalau jabatan di atas sudah ada sebelumnya (dibuat manual oleh Admin
  -- lewat halaman Pegawai) tapi belum punya default_basic_salary (masih 0),
  -- isikan acuannya supaya tidak perlu diketik ulang.
  update employee_positions p set default_basic_salary = x.salary
  from (values
    ('Captain', 2300000),
    ('Chef', 2100000),
    ('Cashier', 1900000),
    ('Bar', 2000000),
    ('Waitress', 1750000),
    ('Security', 1500000),
    ('Team Creative', 2400000)
  ) as x(name, salary)
  where p.business_id = v_business_id and lower(p.name) = lower(x.name) and p.default_basic_salary = 0;
end $$;

-- ----------------------------------------------------------
-- B. PEGAWAI CASUAL — pengganti sementara pegawai tetap yang tidak
--    masuk (mis. sakit/cuti mendadak), diupah HARIAN (daily_rate),
--    bukan gaji pokok bulanan + komponen payroll standar (Tunjangan
--    Makan/Transport, BPJS, dst — itu semua untuk pegawai 'tetap').
--    Absensi tetap dicatat seperti biasa di tabel attendance;
--    payrollService menjumlah upah = daily_rate x hari hadir.
-- ----------------------------------------------------------
alter table employees add column if not exists employment_type text not null default 'tetap'
  check (employment_type in ('tetap', 'casual'));
alter table employees add column if not exists daily_rate numeric(14,2) not null default 0;

comment on column employees.employment_type is
  '''tetap'': pegawai reguler, digaji bulanan (basic_salary + komponen payroll). ''casual'': pengganti sementara, diupah harian (daily_rate x hari hadir), tanpa komponen payroll standar (BPJS/tunjangan).';
comment on column employees.daily_rate is
  'Upah per hari kerja (Rp), dipakai HANYA untuk employment_type = casual.';

-- ----------------------------------------------------------
-- C. BIAYA OPERASIONAL BULANAN — Listrik/Air/Internet/Kebersihan
--    (nominal tetap) + Cadangan Kebutuhan Sosial (persen dari omset
--    bulan berjalan). Terpisah dari payroll_components karena ini
--    BUKAN komponen gaji pegawai, melainkan biaya operasional cafe.
-- ----------------------------------------------------------
create table if not exists operational_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  name text not null,
  category text not null default 'other' check (category in ('utility', 'social', 'other')),
  calc_type text not null default 'fixed' check (calc_type in ('fixed', 'percent_of_revenue')),
  value numeric(14,4) not null,   -- Rp (fixed) atau persen (percent_of_revenue)
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column operational_expenses.value is
  'Rp per bulan (calc_type=fixed) atau persen dari omset bulan berjalan (calc_type=percent_of_revenue).';

alter table operational_expenses enable row level security;

create policy operational_expenses_select on operational_expenses for select
  using (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN', 'OWNER'));
create policy operational_expenses_manage on operational_expenses for all
  using (fn_current_role_code() in ('SUPER_ADMIN', 'OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN', 'OWNER'));

drop trigger if exists trg_audit_operational_expenses on operational_expenses;
create trigger trg_audit_operational_expenses after insert or update on operational_expenses
  for each row execute function fn_audit_trigger();

do $$
declare
  v_business_id uuid;
begin
  select id into v_business_id from business where name = 'Omah Koempoel' limit 1;
  if v_business_id is null then
    return;
  end if;

  insert into operational_expenses (business_id, name, category, calc_type, value, sort_order)
  select v_business_id, x.name, x.category, x.calc_type, x.value, x.sort_order
  from (values
    ('Listrik', 'utility', 'fixed', 500000, 1),
    ('Air', 'utility', 'fixed', 250000, 2),
    ('Internet', 'utility', 'fixed', 350000, 3),
    ('Kebersihan', 'utility', 'fixed', 100000, 4),
    -- ASUMSI: "Cadangan kebutuhan sosial 0.5%/bulan" dihitung dari
    -- OMSET bulan berjalan (pola yang sama dengan komponen "Bonus
    -- Kinerja (Omset)" di payroll_components). Kalau yang dimaksud
    -- adalah 0.5% dari total gaji pegawai atau nominal tetap, ubah
    -- calc_type/value baris ini lewat halaman Payroll > Biaya
    -- Operasional Bulanan.
    ('Cadangan Kebutuhan Sosial', 'social', 'percent_of_revenue', 0.5, 5)
  ) as x(name, category, calc_type, value, sort_order)
  where not exists (
    select 1 from operational_expenses e where e.business_id = v_business_id and lower(e.name) = lower(x.name)
  );
end $$;
