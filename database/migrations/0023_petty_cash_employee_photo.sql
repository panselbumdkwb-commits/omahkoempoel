-- ============================================================
-- OMAH KOEMPOEL — Migration 0023: Kas Kecil Harian, Data Pribadi &
-- Foto Pegawai, Foto Absensi (verifikasi manual)
--
-- Tiga bagian:
--   A. petty_cash_days & petty_cash_entries — "Kas Kecil Harian" di
--      akun Kasir. Nominal awal harian DITENTUKAN oleh Owner/Admin
--      (SUPER_ADMIN/OWNER), lalu Kasir mencatat pemakaiannya selama
--      shift. Saldo = nominal awal - total pemakaian.
--   B. Kolom data pribadi + foto profil di tabel employees.
--   C. Kolom foto check-in/check-out (selfie) di tabel attendance —
--      HANYA untuk verifikasi manual oleh Admin/Owner (dilihat oleh
--      manusia), BUKAN pencocokan wajah otomatis/AI. Ini tetap
--      konsisten dengan catatan privasi di master prompt (Bagian 31):
--      belum ada integrasi biometrik otomatis.
--
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

-- ----------------------------------------------------------
-- A. KAS KECIL HARIAN
-- ----------------------------------------------------------
create table if not exists petty_cash_days (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  cash_date date not null,
  opening_amount numeric(12,2) not null check (opening_amount >= 0),
  opening_notes text,
  opened_by uuid references profiles(id),
  opened_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open','closed')),
  closing_amount numeric(12,2),
  closing_notes text,
  closed_by uuid references profiles(id),
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, cash_date)
);

comment on table petty_cash_days is
  'Kas Kecil Harian di akun Kasir. Satu baris per hari kalender per bisnis. Nominal awal (opening_amount) hanya boleh dibuka/diubah oleh SUPER_ADMIN/OWNER (lihat RLS) — Kasir hanya mencatat pemakaian lewat petty_cash_entries.';

create table if not exists petty_cash_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  petty_cash_day_id uuid not null references petty_cash_days(id) on delete cascade,
  description text not null,
  amount numeric(12,2) not null check (amount > 0),
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

comment on table petty_cash_entries is
  'Pemakaian Kas Kecil Harian (mis. beli es batu, plastik, dll) yang dicatat Kasir selama shift. Total pemakaian dikurangkan dari opening_amount di petty_cash_days untuk mendapat saldo berjalan.';

create index if not exists idx_petty_cash_days_business_date on petty_cash_days(business_id, cash_date desc);
create index if not exists idx_petty_cash_entries_day on petty_cash_entries(petty_cash_day_id);

alter table petty_cash_days enable row level security;
alter table petty_cash_entries enable row level security;

-- Dibaca oleh semua staf operasional (Kasir perlu tahu saldo hari ini)
drop policy if exists petty_cash_days_select on petty_cash_days;
create policy petty_cash_days_select on petty_cash_days for select
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR')
  );

-- Hanya SUPER_ADMIN/OWNER yang boleh MEMBUKA/menentukan nominal awal
-- Kas Kecil hari itu (sesuai permintaan: "ditentukan oleh owner/admin").
drop policy if exists petty_cash_days_insert on petty_cash_days;
create policy petty_cash_days_insert on petty_cash_days for insert
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER')
  );

-- Hanya SUPER_ADMIN/OWNER yang boleh menutup/mengoreksi hari kas kecil.
drop policy if exists petty_cash_days_update on petty_cash_days;
create policy petty_cash_days_update on petty_cash_days for update
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER')
  )
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER')
  );

-- Kasir (dan Captain/Owner/Admin) mencatat pemakaian sehari-hari.
drop policy if exists petty_cash_entries_select on petty_cash_entries;
create policy petty_cash_entries_select on petty_cash_entries for select
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR')
  );

drop policy if exists petty_cash_entries_insert on petty_cash_entries;
create policy petty_cash_entries_insert on petty_cash_entries for insert
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN','KASIR')
  );

-- Hapus/koreksi catatan pemakaian hanya boleh Admin/Owner (mis. salah input).
drop policy if exists petty_cash_entries_delete on petty_cash_entries;
create policy petty_cash_entries_delete on petty_cash_entries for delete
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER')
  );

drop trigger if exists trg_audit_petty_cash_days on petty_cash_days;
create trigger trg_audit_petty_cash_days after insert or update or delete on petty_cash_days
  for each row execute function fn_audit_trigger();

drop trigger if exists trg_audit_petty_cash_entries on petty_cash_entries;
create trigger trg_audit_petty_cash_entries after insert or update or delete on petty_cash_entries
  for each row execute function fn_audit_trigger();

-- ----------------------------------------------------------
-- B. DATA PRIBADI + FOTO PEGAWAI
-- ----------------------------------------------------------
alter table employees add column if not exists photo_path text;
alter table employees add column if not exists email text;
alter table employees add column if not exists birth_date date;
alter table employees add column if not exists gender text check (gender in ('L','P') or gender is null);
alter table employees add column if not exists id_number text; -- NIK/KTP
alter table employees add column if not exists address text;
alter table employees add column if not exists emergency_contact_name text;
alter table employees add column if not exists emergency_contact_phone text;

comment on column employees.photo_path is
  'Path file di bucket storage privat employee-photos (BUKAN url publik) — dibaca lewat signed URL berumur pendek yang dibuat server (lihat employeeService.getEmployeePhotoUrl). Dibuat privat karena ini data pribadi pegawai, beda dari foto menu produk yang memang publik.';
comment on column employees.id_number is 'Nomor Induk Kependudukan (KTP) pegawai — data pribadi. Terlihat oleh siapa pun yang berhak melihat baris tabel employees (SUPER_ADMIN/OWNER penuh, CAPTAIN read-only — lihat RLS employees_admin_full & employees_captain_view di migration 0002 & 0016).';

-- ----------------------------------------------------------
-- C. FOTO ABSENSI (verifikasi manual, bukan face-recognition otomatis)
-- ----------------------------------------------------------
alter table attendance add column if not exists clock_in_photo_path text;
alter table attendance add column if not exists clock_out_photo_path text;

comment on column attendance.clock_in_photo_path is
  'Foto wajah pegawai saat presensi masuk (selfie dari kamera kiosk/HP), disimpan sebagai path di bucket privat employee-photos. HANYA untuk verifikasi manual oleh Admin/Owner — TIDAK ada pencocokan wajah otomatis/AI di sistem ini.';
comment on column attendance.clock_out_photo_path is
  'Sama seperti clock_in_photo_path, untuk presensi pulang.';

-- ----------------------------------------------------------
-- STORAGE BUCKET: employee-photos (PRIVAT — bukan public seperti bucket
-- products, karena berisi data pribadi/wajah pegawai).
-- Baca (select) dibatasi staf yang berwenang; upload lewat sesi admin
-- ATAU service-role (kiosk/absen mandiri HP tanpa login staf).
-- ----------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('employee-photos', 'employee-photos', false)
on conflict (id) do nothing;

drop policy if exists "employee_photos_staff_read" on storage.objects;
create policy "employee_photos_staff_read"
  on storage.objects for select
  using (
    bucket_id = 'employee-photos'
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN')
  );

-- Upload/ubah foto PROFIL pegawai (bukan foto absensi) hanya dari sesi
-- SUPER_ADMIN/OWNER yang login di halaman Pegawai.
drop policy if exists "employee_photos_admin_insert" on storage.objects;
create policy "employee_photos_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'employee-photos' and fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

drop policy if exists "employee_photos_admin_update" on storage.objects;
create policy "employee_photos_admin_update"
  on storage.objects for update
  using (bucket_id = 'employee-photos' and fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

drop policy if exists "employee_photos_admin_delete" on storage.objects;
create policy "employee_photos_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'employee-photos' and fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

-- Catatan: foto SELFIE ABSENSI dari Kiosk/Absen Mandiri HP diunggah lewat
-- supabaseAdmin (service role) di server action, sama seperti pola yang
-- sudah dipakai mobileAttendanceService.ts untuk data absensi lain —
-- service role otomatis melewati RLS di atas, jadi tidak perlu policy
-- insert tambahan untuk KASIR/pegawai non-login.
