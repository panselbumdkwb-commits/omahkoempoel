-- ============================================================
-- OMAH KOEMPOEL — Migration 0024: Login Mandiri Pegawai (Username +
--   Password) untuk Absen Mandiri lewat HP Pribadi.
--
--   Sebelum migration ini, absen lewat HP pribadi cuma pakai PIN +
--   pegawai memilih namanya sendiri dari dropdown publik (lihat
--   migration 0022) — siapa saja yang tahu PIN & nama rekan kerja bisa
--   absen atas nama orang lain. Migration ini menambahkan login
--   sungguhan (username + password) khusus untuk HP pribadi, terpisah
--   dari PIN kios (attendance_pin_hash TETAP dipakai untuk kios/
--   perangkat bersama di Kedai — migration 0008 — karena mengetik
--   password di perangkat bersama kurang aman, PIN pendek lebih pas).
--
--   Setelah login, sesi disimpan lewat cookie HttpOnly umur panjang
--   (~10 tahun, lihat src/lib/mobileSession.ts) supaya pegawai HANYA
--   perlu login SEKALI di HP masing-masing ("sekali login untuk
--   selamanya" sesuai permintaan) — bukan session Supabase Auth biasa,
--   karena pegawai login pakai USERNAME (bukan email) dan tidak semua
--   pegawai warung kopi harian ini punya email.
--
--   Password dihash dengan scrypt+salt (src/lib/password.ts, pola sama
--   persis dengan src/lib/pin.ts) — tidak pernah disimpan plaintext.
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

-- ----------------------------------------------------------
-- A. Kredensial login mobile per pegawai. Dibuat pertama kali oleh
--    Captain/Admin/Owner saat verifikasi pendaftaran (lihat
--    employeeRegistrationService.verifyRegistrationRequest) atau
--    lewat "Reset Login HP" di halaman Pegawai kalau pegawai lupa
--    password / ganti HP dan sesi lama perlu dicabut.
-- ----------------------------------------------------------
alter table employees add column if not exists mobile_username text;
alter table employees add column if not exists mobile_password_hash text;

comment on column employees.mobile_username is
  'Username login Absen Mandiri (HP pribadi) — beda dari attendance_pin_hash yang dipakai kios. Unik per business, tidak case-sensitive (lihat idx_employees_mobile_username_unique).';
comment on column employees.mobile_password_hash is
  'Hash scrypt+salt (src/lib/password.ts) password login Absen Mandiri. Pegawai bisa menggantinya sendiri lewat /pegawai/akun.';

create unique index if not exists idx_employees_mobile_username_unique
  on employees (business_id, lower(mobile_username))
  where mobile_username is not null;

-- ----------------------------------------------------------
-- B. Sesi login mobile — token acak (bukan JWT) supaya bisa dicabut
--    kapan saja (mis. "Reset Login HP" di atas, atau pegawai pilih
--    "Keluar"). Hanya HASH token yang disimpan (sha256, cukup karena
--    token sumbernya sudah acak 256-bit, beda kebutuhan dengan hash
--    password yang harus tahan brute-force offline).
-- ----------------------------------------------------------
create table if not exists employee_mobile_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  session_token_hash text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

comment on table employee_mobile_sessions is
  'Sesi login Absen Mandiri (HP pribadi pegawai) — umur panjang by design ("sekali login untuk selamanya"). Dibaca/ditulis HANYA lewat supabaseAdmin di src/lib/mobileSession.ts (server-only), sama seperti pola PIN kios & pendaftaran mandiri — bukan lewat sesi Supabase Auth, jadi RLS di bawah sengaja tidak membuka akses apa pun ke anon/authenticated.';

create index if not exists idx_employee_mobile_sessions_token on employee_mobile_sessions (session_token_hash);
create index if not exists idx_employee_mobile_sessions_employee on employee_mobile_sessions (employee_id);

alter table employee_mobile_sessions enable row level security;
-- Sengaja TIDAK ada policy sama sekali: akses hanya lewat supabaseAdmin
-- (service role, bypass RLS) di server-only code, konsisten dengan
-- employee_registration_requests (migration 0022) untuk operasi yang
-- terjadi sebelum ada sesi login staf back-office.
