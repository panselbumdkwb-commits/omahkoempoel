-- ============================================================
-- OMAH KOEMPOEL — Migration 0016: Captain full access (KASIR +
-- view seperti Admin/Owner) & Klasifikasi Biaya Operasional vs
-- Non-Operasional untuk Laporan Laba Rugi.
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

-- ----------------------------------------------------------
-- A. CAPTAIN bisa menjalankan rule & role KASIR sepenuhnya (buka
--    order, tambah item, terima pembayaran, kelola meja) — bukan
--    lagi read-only Jadwal Shift & Absensi saja seperti migration
--    0014. Kebijakan lama TIDAK dihapus (permissive policies di
--    Postgres di-OR-kan), kita tambah CAPTAIN di policy yang sudah
--    ada dengan create-or-replace lewat drop+create supaya jelas.
-- ----------------------------------------------------------

drop policy if exists orders_select on orders;
create policy orders_select on orders for select
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE','KITCHEN','BAR')
  );

drop policy if exists orders_insert on orders;
create policy orders_insert on orders for insert
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE')
  );

drop policy if exists orders_update on orders;
create policy orders_update on orders for update
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE','KITCHEN','BAR')
  )
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE','KITCHEN','BAR')
  );

drop policy if exists order_items_select on order_items;
create policy order_items_select on order_items for select
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE','KITCHEN','BAR')
  );

drop policy if exists order_items_insert on order_items;
create policy order_items_insert on order_items for insert
  with check (
    fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE')
  );

drop policy if exists order_items_update on order_items;
create policy order_items_update on order_items for update
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE')
  )
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE')
  );

drop policy if exists order_item_modifiers_select on order_item_modifiers;
create policy order_item_modifiers_select on order_item_modifiers for select
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE','KITCHEN','BAR'));

drop policy if exists order_item_modifiers_insert on order_item_modifiers;
create policy order_item_modifiers_insert on order_item_modifiers for insert
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE'));

drop policy if exists payments_select on payments;
create policy payments_select on payments for select
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR')
  );

drop policy if exists payments_insert on payments;
create policy payments_insert on payments for insert
  with check (
    fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR')
  );

drop policy if exists tables_manage on tables;
create policy tables_manage on tables for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE'));

drop policy if exists order_number_counters_rw on order_number_counters;
create policy order_number_counters_rw on order_number_counters for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE'));

-- ----------------------------------------------------------
-- B. CAPTAIN diberi akses 'view' (SELECT saja, tidak bisa
--    tambah/ubah/hapus) yang setara dengan yang dilihat OWNER, di
--    semua data admin: Pegawai, Payroll, Biaya Operasional, Profil
--    staff. Menulis/mengubah data ini TETAP hanya SUPER_ADMIN/OWNER
--    (policy *_manage / *_rw yang sudah ada TIDAK diubah).
-- ----------------------------------------------------------

drop policy if exists employees_captain_view on employees;
create policy employees_captain_view on employees for select
  using (business_id = fn_current_business_id() and fn_current_role_code() = 'CAPTAIN');

drop policy if exists profiles_select_captain on profiles;
create policy profiles_select_captain on profiles for select
  using (business_id = fn_current_business_id() and fn_current_role_code() = 'CAPTAIN');

drop policy if exists payroll_components_captain_view on payroll_components;
create policy payroll_components_captain_view on payroll_components for select
  using (business_id = fn_current_business_id() and fn_current_role_code() = 'CAPTAIN');

drop policy if exists payroll_periods_captain_view on payroll_periods;
create policy payroll_periods_captain_view on payroll_periods for select
  using (business_id = fn_current_business_id() and fn_current_role_code() = 'CAPTAIN');

drop policy if exists payroll_items_captain_view on payroll_items;
create policy payroll_items_captain_view on payroll_items for select
  using (business_id = fn_current_business_id() and fn_current_role_code() = 'CAPTAIN');

drop policy if exists operational_expenses_captain_view on operational_expenses;
create policy operational_expenses_captain_view on operational_expenses for select
  using (business_id = fn_current_business_id() and fn_current_role_code() = 'CAPTAIN');

drop policy if exists operational_expense_entries_captain_view on operational_expense_entries;
create policy operational_expense_entries_captain_view on operational_expense_entries for select
  using (business_id = fn_current_business_id() and fn_current_role_code() = 'CAPTAIN');

drop policy if exists audit_logs_captain_view on audit_logs;
create policy audit_logs_captain_view on audit_logs for select
  using (business_id = fn_current_business_id() and fn_current_role_code() = 'CAPTAIN');

-- employee_schedules & attendance select untuk CAPTAIN sudah ada sejak
-- migration 0011 & 0014 — tidak perlu diubah lagi di sini.

-- ----------------------------------------------------------
-- C. KLASIFIKASI BIAYA: Operasional vs Non-Operasional — dipakai
--    Laporan Laba Rugi supaya Owner bisa lihat pemisahan biaya yang
--    berhubungan langsung dengan operasional cafe (listrik, air,
--    internet, kebersihan, gaji pegawai) vs biaya di luar operasional
--    utama (mis. bunga bank, penyusutan aset, biaya administrasi,
--    sumbangan/CSR non-rutin, kerugian lain-lain).
-- ----------------------------------------------------------
alter table operational_expenses
  add column if not exists expense_type text not null default 'operational'
  check (expense_type in ('operational', 'non_operational'));

comment on column operational_expenses.expense_type is
  'Klasifikasi untuk Laporan Laba Rugi: ''operational'' (biaya operasional inti — listrik, air, internet, kebersihan, dll) atau ''non_operational'' (di luar operasional utama — bunga bank, penyusutan, adm. bank, dll).';

-- Semua biaya yang sudah ada (Listrik, Air, Internet, Kebersihan,
-- Cadangan Kebutuhan Sosial) memang biaya operasional inti cafe —
-- default 'operational' di atas sudah benar, tidak perlu di-backfill
-- ulang secara khusus.
