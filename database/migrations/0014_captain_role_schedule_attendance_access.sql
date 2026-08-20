-- ============================================================
-- OMAH KOEMPOEL — Migration 0014: Role Captain + Akses Jadwal Shift
-- & Absensi (Ijin/Keterlambatan) untuk Admin, Captain, Owner
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

-- ----------------------------------------------------------
-- A. Role CAPTAIN (akun login) — TERPISAH dari "Captain" jabatan
--    (employee_positions, migration 0012) yang cuma menentukan gaji
--    pokok. Role ini menentukan HAK AKSES login: Captain bisa masuk
--    ke /admin TAPI hanya melihat Jadwal Shift & Absensi (read-only),
--    bukan Payroll/Kelola Menu/Kelola User/Pengaturan.
-- ----------------------------------------------------------
do $$
declare
  v_business_id uuid;
begin
  select id into v_business_id from business where name = 'Omah Koempoel' limit 1;
  if v_business_id is null then
    return;
  end if;

  insert into roles (business_id, code, name, description)
  values (v_business_id, 'CAPTAIN', 'Captain', 'Lihat Jadwal Shift & Absensi (ijin/keterlambatan) pegawai — read-only')
  on conflict (business_id, code) do nothing;
end $$;

-- CAPTAIN diberi permission read-only yang relevan (employee.view) —
-- konsisten dengan pola permission role lain, walau sebagian besar
-- pengecekan akses di app ini pakai fn_current_role_code() langsung
-- (lihat policy di bawah), bukan tabel permissions.
do $$
declare
  r_captain uuid;
  p_employee_view uuid;
begin
  select id into r_captain from roles where code = 'CAPTAIN';
  select id into p_employee_view from permissions where code = 'employee.view';
  if r_captain is not null and p_employee_view is not null then
    insert into role_permissions (role_id, permission_id)
    values (r_captain, p_employee_view)
    on conflict do nothing;
  end if;
end $$;

-- ----------------------------------------------------------
-- B. Jadwal Shift (employee_schedules) — CAPTAIN ikut bisa MELIHAT
--    (bukan mengubah — susun/ubah jadwal tetap wewenang SUPER_ADMIN/
--    OWNER, lihat employee_schedules_manage yang TIDAK diubah di sini).
-- ----------------------------------------------------------
drop policy if exists employee_schedules_select on employee_schedules;
create policy employee_schedules_select on employee_schedules
  for select using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR','FRONT_SERVE','KITCHEN')
  );

-- ----------------------------------------------------------
-- C. Absensi / attendance (status ijin & keterlambatan pegawai) —
--    CAPTAIN ikut bisa MELIHAT. Mencatat/mengubah absensi tetap
--    wewenang SUPER_ADMIN/OWNER (attendance_manage TIDAK diubah).
-- ----------------------------------------------------------
drop policy if exists attendance_select on attendance;
create policy attendance_select on attendance for select
  using (
    business_id = fn_current_business_id()
    and (fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN')
         or employee_id in (select id from employees where profile_id = auth.uid()))
  );
