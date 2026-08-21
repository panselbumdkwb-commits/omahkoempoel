-- ============================================================
-- OMAH KOEMPOEL — Migration 0022: Pendaftaran Akun Pegawai Mandiri +
--   Absensi lewat Smartphone Pribadi.
--   Alur: pegawai isi form pendaftaran mandiri (nama, telepon, jabatan
--   yang diklaim) lewat HP pribadinya -> masuk antrian 'pending' ->
--   Captain/Admin/Owner verifikasi & tautkan ke data pegawai (pegawai
--   baru dibuat otomatis kalau belum ada) -> PIN absensi dibuat/dipakai
--   ulang -> pegawai bisa absen mandiri lewat HP pribadi, dengan absen
--   MASUK wajib berada dalam radius 2 meter dari lokasi Kedai (lihat
--   business.latitude/longitude, migration 0020), sedangkan pengajuan
--   IJIN/tidak masuk boleh dari mana saja.
--   Keamanan memakai pola yang sama seperti kios (PIN hash per
--   pegawai) lewat supabaseAdmin di service layer, bukan sesi login
--   penuh — konsisten dengan src/services/kioskService.ts.
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

-- ----------------------------------------------------------
-- A. Kolom tambahan di attendance: sumber (kios/HP pribadi/manual
--    admin) & koordinat GPS saat absen masuk/pulang lewat HP pribadi
--    (dipakai untuk validasi radius & sebagai jejak audit lokasi).
-- ----------------------------------------------------------
alter table attendance add column if not exists source text not null default 'kiosk'
  check (source in ('kiosk', 'mobile', 'admin'));
alter table attendance add column if not exists clock_in_lat numeric(10,7);
alter table attendance add column if not exists clock_in_lng numeric(10,7);
alter table attendance add column if not exists clock_out_lat numeric(10,7);
alter table attendance add column if not exists clock_out_lng numeric(10,7);

comment on column attendance.source is
  'kiosk = perangkat bersama di Kedai (PIN, tanpa cek lokasi); mobile = HP pribadi pegawai (PIN + wajib radius 2m saat absen masuk); admin = dicatat manual oleh Admin/Owner/Captain di halaman Absensi.';

-- ----------------------------------------------------------
-- B. Pendaftaran akun pegawai mandiri — antrian verifikasi.
-- ----------------------------------------------------------
create table if not exists employee_registration_requests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  full_name text not null,
  phone text not null,
  claimed_position_name text,
  claimed_employee_code text, -- diisi pegawai kalau merasa sudah pernah didata Admin sebelumnya
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  linked_employee_id uuid references employees(id),
  rejection_reason text,
  verified_by uuid references profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table employee_registration_requests is
  'Antrian pendaftaran akun absensi mandiri oleh pegawai lewat HP pribadi. Insert dilakukan via service role (halaman publik, tanpa login) — RLS di sini hanya mengatur siapa yang boleh MELIHAT & MEMVERIFIKASI (Captain/Admin/Owner).';

create index if not exists idx_employee_registration_requests_status on employee_registration_requests (business_id, status);

alter table employee_registration_requests enable row level security;

drop policy if exists employee_registration_requests_select on employee_registration_requests;
create policy employee_registration_requests_select on employee_registration_requests for select
  using (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'));

-- Verifikasi (update status/link) oleh Captain/Admin/Owner. Insert baru
-- TIDAK dibuka lewat RLS sama sekali — pendaftaran publik lewat
-- supabaseAdmin di employeeRegistrationService.ts (server-only), sama
-- seperti pola kiosk, supaya form publik tidak butuh login pegawai.
drop policy if exists employee_registration_requests_verify on employee_registration_requests;
create policy employee_registration_requests_verify on employee_registration_requests for update
  using (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'))
  with check (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'));
