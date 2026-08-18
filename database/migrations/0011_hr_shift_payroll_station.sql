-- ============================================================
-- OMAH KOEMPOEL — Migration 0011: HR Upgrade + Shift Otomatis +
-- Payroll (Absensi & Bonus Omset) + Routing Dapur/Bar
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

-- ----------------------------------------------------------
-- A. ABSENSI — tambah status 'sick' (Sakit, beda dari 'leave'/Ijin)
--    dan kolom late_minutes (menit keterlambatan, diisi manual oleh
--    Admin/Owner saat status = 'late', dipakai payroll untuk hitung
--    potongan keterlambatan per akumulasi 60 menit).
-- ----------------------------------------------------------
alter table attendance add column if not exists late_minutes int not null default 0;

alter table attendance drop constraint if exists attendance_status_check;
alter table attendance add constraint attendance_status_check
  check (status in ('present','late','absent','leave','sick','early_leave'));

comment on column attendance.late_minutes is
  'Menit keterlambatan (diisi saat status=late). Payroll memotong Rp5.000 per akumulasi 60 menit.';

-- ----------------------------------------------------------
-- B. EMPLOYEES — pastikan kolom deleted_at bisa dipakai sebagai
--    soft-delete (kolom sudah ada dari migration 0001). Tambahkan
--    index supaya query listEmployees(deleted_at is null) cepat.
-- ----------------------------------------------------------
create index if not exists idx_employees_deleted_at on employees (deleted_at);
create index if not exists idx_employees_position_id on employees (position_id);

-- ----------------------------------------------------------
-- C. PAYROLL COMPONENTS — perluas calc_type supaya bisa data-driven
--    untuk kompensasi harian, potongan absensi, dan bonus omset
--    (bukan hardcode formula di kode, sesuai prinsip aplikasi ini).
-- ----------------------------------------------------------
alter table payroll_components drop constraint if exists payroll_components_calc_type_check;
alter table payroll_components add constraint payroll_components_calc_type_check
  check (calc_type in (
    'fixed',                    -- nominal tetap per bulan
    'percent_of_basic',         -- persen dari gaji pokok
    'per_day_present',          -- value x jumlah hari hadir/terlambat (kompensasi makan harian)
    'deduction_per_leave_day',  -- value x jumlah hari Ijin
    'deduction_per_sick_day',   -- value x jumlah hari Sakit
    'deduction_per_late_block', -- value x akumulasi keterlambatan per 60 menit
    'revenue_bonus_share'       -- (omset bulan - cap_base) x value% dibagi rata pegawai aktif, min Rp200rb/orang
  ));

comment on column payroll_components.value is
  'Rp (fixed/per_day_present/deduction_*) atau persen (percent_of_basic/revenue_bonus_share).';
comment on column payroll_components.cap_base is
  'percent_of_basic: batas upah dasar. revenue_bonus_share: ambang omset bulanan (mis. 75.000.000).';

-- Perbarui komponen default supaya sesuai kebijakan pengupahan terbaru.
-- Dicocokkan berdasarkan nama; kalau Owner sudah pernah mengubah nama,
-- UPDATE ini tidak akan menimpa apa pun (WHERE name = ...) — aman.
update payroll_components set value = 200000
  where name = 'Tunjangan Makan' and calc_type = 'fixed';

do $$
declare
  v_business_id uuid;
begin
  select id into v_business_id from business where name = 'Omah Koempoel' limit 1;
  if v_business_id is null then
    return;
  end if;

  -- Uang Makan (kalau komponen "Tunjangan Makan" lama tidak ditemukan)
  if not exists (select 1 from payroll_components where business_id = v_business_id and name = 'Uang Makan') then
    insert into payroll_components (business_id, name, component_type, calc_type, value, cap_base, sort_order)
    values (v_business_id, 'Uang Makan', 'earning', 'fixed', 200000, null, 1);
  end if;

  -- Kompensasi Makan Harian: Rp10.000 x hari hadir/terlambat
  if not exists (select 1 from payroll_components where business_id = v_business_id and name = 'Kompensasi Makan Harian') then
    insert into payroll_components (business_id, name, component_type, calc_type, value, cap_base, sort_order)
    values (v_business_id, 'Kompensasi Makan Harian', 'earning', 'per_day_present', 10000, null, 2);
  end if;

  -- Bonus Kinerja (Omset): (Omset bulan - Rp75.000.000) x 100%, dibagi rata
  -- pegawai aktif, minimum Rp200.000/orang/bulan (aturan minimum diterapkan
  -- di service layer, sama seperti batas upah BPJS JP yang juga berbasis
  -- cap_base pada komponen di bawah).
  if not exists (select 1 from payroll_components where business_id = v_business_id and name = 'Bonus Kinerja (Omset)') then
    insert into payroll_components (business_id, name, component_type, calc_type, value, cap_base, sort_order)
    values (v_business_id, 'Bonus Kinerja (Omset)', 'earning', 'revenue_bonus_share', 100, 75000000, 3);
  end if;

  -- Potongan Ijin: Rp30.000/hari
  if not exists (select 1 from payroll_components where business_id = v_business_id and name = 'Potongan Ijin') then
    insert into payroll_components (business_id, name, component_type, calc_type, value, cap_base, sort_order)
    values (v_business_id, 'Potongan Ijin', 'deduction', 'deduction_per_leave_day', 30000, null, 20);
  end if;

  -- Potongan Sakit: Rp20.000/hari
  if not exists (select 1 from payroll_components where business_id = v_business_id and name = 'Potongan Sakit') then
    insert into payroll_components (business_id, name, component_type, calc_type, value, cap_base, sort_order)
    values (v_business_id, 'Potongan Sakit', 'deduction', 'deduction_per_sick_day', 20000, null, 21);
  end if;

  -- Potongan Keterlambatan: Rp5.000 per akumulasi 60 menit
  if not exists (select 1 from payroll_components where business_id = v_business_id and name = 'Potongan Keterlambatan') then
    insert into payroll_components (business_id, name, component_type, calc_type, value, cap_base, sort_order)
    values (v_business_id, 'Potongan Keterlambatan', 'deduction', 'deduction_per_late_block', 5000, null, 22);
  end if;
end $$;

-- ----------------------------------------------------------
-- D. KATALOG — kolom `station` di products, dipakai untuk merutekan
--    pesanan makanan ke Dapur (Kitchen) dan minuman ke Bar.
--    Default 'kitchen' supaya produk lama tetap tampil di papan dapur
--    (aman, tidak "hilang" begitu migration jalan — Owner tinggal
--    pindahkan produk minuman ke station 'bar' lewat halaman Kelola Menu).
-- ----------------------------------------------------------
alter table products add column if not exists station text not null default 'kitchen'
  check (station in ('kitchen','bar'));
alter table categories add column if not exists default_station text not null default 'kitchen'
  check (default_station in ('kitchen','bar'));

comment on column products.station is
  'Tujuan konfirmasi pesanan: kitchen (makanan) atau bar (minuman).';
comment on column categories.default_station is
  'Station default untuk produk baru yang dibuat di kategori ini (memudahkan input, tetap bisa diubah per-produk).';

-- Tebak otomatis kategori yang namanya mengandung kata minuman umum,
-- supaya data lama tidak perlu diedit satu-satu (Owner tetap bisa
-- koreksi manual lewat Kelola Menu kalau tebakan ini salah).
update categories set default_station = 'bar'
  where lower(name) similar to '%(minuman|drink|beverage|kopi|coffee|jus|juice|teh|tea|milkshake|mocktail|kokt)%';

update products set station = 'bar'
  where category_id in (select id from categories where default_station = 'bar');

-- ----------------------------------------------------------
-- E. ROLE BARU: BAR (pola sama seperti migration 0009 untuk KITCHEN)
-- ----------------------------------------------------------
do $$
declare
  v_business_id uuid;
  v_role_bar uuid;
begin
  select id into v_business_id from business where name = 'Omah Koempoel' limit 1;
  if v_business_id is null then
    return;
  end if;

  insert into roles (business_id, code, name, description) values
    (v_business_id, 'BAR', 'Bar', 'Menerima & memproses pesanan minuman dari kasir/pelanggan')
  on conflict (business_id, code) do nothing;

  select id into v_role_bar from roles where business_id = v_business_id and code = 'BAR';

  insert into permissions (code, module, description) values
    ('order.bar_process', 'order', 'Memproses status order minuman di Bar')
  on conflict (code) do nothing;

  insert into role_permissions (role_id, permission_id)
  select v_role_bar, id from permissions
  where code in ('order.view', 'order.bar_process')
  on conflict do nothing;
end $$;

-- Perluas RLS orders/order_items/order_item_modifiers supaya role BAR
-- punya akses yang sama seperti KITCHEN (lihat & ubah status order,
-- TIDAK bisa memproses pembayaran).
drop policy if exists orders_select on orders;
create policy orders_select on orders for select
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE','KITCHEN','BAR')
  );

drop policy if exists orders_update on orders;
create policy orders_update on orders for update
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE','KITCHEN','BAR')
  )
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE','KITCHEN','BAR')
  );

drop policy if exists order_items_select on order_items;
create policy order_items_select on order_items for select
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE','KITCHEN','BAR')
  );

drop policy if exists order_item_modifiers_select on order_item_modifiers;
create policy order_item_modifiers_select on order_item_modifiers for select
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE','KITCHEN','BAR'));

-- ----------------------------------------------------------
-- F. JADWAL KERJA — izinkan role BAR ikut melihat jadwalnya sendiri,
--    konsisten dengan role lain di migration 0010.
-- ----------------------------------------------------------
drop policy if exists employee_schedules_select on employee_schedules;
create policy employee_schedules_select on employee_schedules
  for select using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE','KITCHEN','BAR')
  );
