-- ============================================================
-- OMAH KOEMPOEL — Migration 0013: Biaya Operasional Variabel
-- (Listrik & Air berubah tiap bulan sesuai pemakaian — TIDAK bisa
-- diasumsikan nominal tetap seperti Internet/Kebersihan. Owner
-- mencatat tagihan aktual tiap bulan lewat operational_expense_entries,
-- bukan angka perkiraan yang otomatis dipakai terus-menerus.)
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

-- ----------------------------------------------------------
-- A. Tambah pilihan calc_type baru: 'variable_manual' — nominalnya
--    TIDAK disimpan di kolom `value` (yang dipakai fixed/percent_of_revenue),
--    melainkan dicatat per bulan di tabel operational_expense_entries.
-- ----------------------------------------------------------
alter table operational_expenses drop constraint if exists operational_expenses_calc_type_check;
alter table operational_expenses add constraint operational_expenses_calc_type_check
  check (calc_type in ('fixed', 'percent_of_revenue', 'variable_manual'));

comment on column operational_expenses.value is
  'Rp/bulan (calc_type=fixed) atau persen dari omset (calc_type=percent_of_revenue). TIDAK dipakai untuk calc_type=variable_manual — nominal bulanan dicatat manual di operational_expense_entries karena berubah-ubah sesuai pemakaian (mis. Listrik, Air).';

-- Ubah Listrik & Air (diseed sebagai 'fixed' di migration 0012) jadi
-- 'variable_manual' — Internet & Kebersihan TETAP 'fixed' karena
-- mengikuti harga paket/layanan yang nominalnya sama tiap bulan.
do $$
declare
  v_business_id uuid;
begin
  select id into v_business_id from business where name = 'Omah Koempoel' limit 1;
  if v_business_id is null then
    return;
  end if;

  update operational_expenses
  set calc_type = 'variable_manual', value = 0
  where business_id = v_business_id and name in ('Listrik', 'Air') and calc_type = 'fixed';
end $$;

-- ----------------------------------------------------------
-- B. Catatan nominal aktual per bulan untuk biaya variable_manual.
--    period_month format 'YYYY-MM' (bulan kalender, bukan rentang
--    tanggal bebas — tagihan listrik/air memang ditagih per bulan
--    kalender, beda dari periode payroll yang bisa custom).
-- ----------------------------------------------------------
create table if not exists operational_expense_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  expense_id uuid not null references operational_expenses(id) on delete cascade,
  period_month text not null check (period_month ~ '^\d{4}-\d{2}$'),
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  unique (expense_id, period_month)
);

comment on column operational_expense_entries.period_month is
  'Bulan kalender tagihan, format YYYY-MM (mis. 2026-08 untuk Agustus 2026).';

alter table operational_expense_entries enable row level security;

create policy operational_expense_entries_select on operational_expense_entries for select
  using (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN', 'OWNER'));
create policy operational_expense_entries_manage on operational_expense_entries for all
  using (fn_current_role_code() in ('SUPER_ADMIN', 'OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN', 'OWNER'));

drop trigger if exists trg_audit_operational_expense_entries on operational_expense_entries;
create trigger trg_audit_operational_expense_entries after insert or update on operational_expense_entries
  for each row execute function fn_audit_trigger();
