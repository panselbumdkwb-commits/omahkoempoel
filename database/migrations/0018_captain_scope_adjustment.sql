-- ============================================================
-- OMAH KOEMPOEL — Migration 0018: Penyesuaian Hak Akses Captain
--   A. Captain TIDAK BOLEH lagi 'view' Laporan & Payroll (dicabut dari
--      migration 0016). Gerbang halaman /admin/reports & /admin/payroll
--      juga diubah ke requireSuperAdminOrOwner() di kode (lihat commit
--      terkait) — perubahan RLS di sini mengunci itu di level database
--      juga, supaya tidak bisa dilewati lewat query langsung.
--   B. Captain DIBERI hak kelola (bukan cuma lihat) atas Pegawai &
--      Absensi — sesuai permintaan: Captain mengontrol pegawai & akses
--      Absensi. Perubahan gaji pokok (basic_salary) tetap dilindungi
--      lewat trigger (bagian C) supaya Captain tidak bisa mengubah
--      komponen payroll walau lewat form Pegawai.
--   C. Trigger proteksi kolom basic_salary di tabel employees supaya
--      Captain tidak bisa mengubahnya (data payroll tetap wewenang
--      SUPER_ADMIN/OWNER walau tabelnya sekarang bisa ditulis Captain).
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

-- ----------------------------------------------------------
-- A. Cabut akses lihat Payroll untuk CAPTAIN (dari migration 0016)
-- ----------------------------------------------------------
drop policy if exists payroll_components_captain_view on payroll_components;
drop policy if exists payroll_periods_captain_view on payroll_periods;
drop policy if exists payroll_items_captain_view on payroll_items;

-- ----------------------------------------------------------
-- B1. Pegawai (employees) — Captain sekarang bisa kelola (create/
--     update/status/hapus), setara SUPER_ADMIN/OWNER di tabel ini.
-- ----------------------------------------------------------
drop policy if exists employees_captain_view on employees;
drop policy if exists employees_admin_full on employees;
create policy employees_admin_full on employees
  for all using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN')
  )
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN')
  );

-- ----------------------------------------------------------
-- B2. Absensi (attendance) — Captain bisa kelola penuh (catat manual,
--     ubah, hapus), bukan cuma lihat seperti migration 0014.
-- ----------------------------------------------------------
drop policy if exists attendance_manage on attendance;
create policy attendance_manage on attendance for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'));

-- attendance_select (0007) & 0014 sudah mengizinkan CAPTAIN SELECT —
-- tidak perlu diubah, attendance_manage 'for all' di atas mencakup select juga.

-- ----------------------------------------------------------
-- C. Proteksi basic_salary: Captain boleh kelola data pegawai lainnya,
--    TAPI kolom gaji pokok tetap dikunci ke nilai lama kalau yang
--    menulis adalah Captain (pertahanan berlapis — form UI juga
--    menyembunyikan field ini untuk Captain, lihat EmployeesClient.tsx).
-- ----------------------------------------------------------
create or replace function fn_protect_employee_salary_from_captain()
returns trigger language plpgsql as $$
begin
  if fn_current_role_code() = 'CAPTAIN' and NEW.basic_salary is distinct from OLD.basic_salary then
    NEW.basic_salary := OLD.basic_salary;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_protect_employee_salary on employees;
create trigger trg_protect_employee_salary
  before update on employees
  for each row execute function fn_protect_employee_salary_from_captain();
