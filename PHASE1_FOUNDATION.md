# PHASE 1 — FOUNDATION

## A. Tujuan Phase
Membangun fondasi sistem: skema database inti (business, RBAC, profiles, employees),
Row Level Security yang menegakkan RBAC di level database, audit trail otomatis,
system settings (configuration over hardcoding), dan design token untuk UI.

## B. File yang dibuat
```
database/migrations/0001_foundation_schema.sql
database/migrations/0002_rls_policies.sql
database/seed/0001_roles_permissions.sql
src/config/design-tokens.ts
.env.example
.gitignore
```

## C. Database migration
Jalankan berurutan di Supabase SQL Editor (project DEV dulu):
1. `0001_foundation_schema.sql` — tabel + audit trigger
2. `0002_rls_policies.sql` — RLS policy per tabel
3. `seed/0001_roles_permissions.sql` — isi role & permission awal

## D. Source code
Lihat isi file di atas. `design-tokens.ts` siap dipakai sebagai sumber Tailwind
theme config di Phase 2.

## E. Environment variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only, isi di Vercel, bukan di .env lokal yang di-commit
```

## F. Cara menjalankan
1. Buat project Supabase dev (lihat panduan setup terpisah).
2. Copy `.env.example` → `.env.local`, isi dengan kredensial project dev.
3. Jalankan ketiga file SQL di atas lewat Supabase SQL Editor, berurutan.
4. Buat user pertama lewat Supabase Auth, lalu insert manual 1 baris di
   `profiles` dengan `role_id` = SUPER_ADMIN untuk akun pertama Anda.

## G. Cara testing
- **Test RLS**: login sebagai user dengan role KASIR (belum ada di employees),
  coba `select * from employees` lewat client biasa (anon/authenticated key) →
  harus gagal/kosong kecuali baris miliknya sendiri.
- **Test audit**: update satu baris di `system_settings`, cek `audit_logs`
  otomatis bertambah 1 baris dengan `old_value`/`new_value` terisi.
- **Test immutability**: coba `delete from audit_logs` sebagai role apa pun
  selain lewat service role langsung di server → harus ditolak (tidak ada
  policy DELETE yang dibuat).

## H. Expected result
- Tabel foundation ada di Supabase dengan RLS **aktif** (bukan sekadar dibuat).
- Role SUPER_ADMIN, OWNER, KASIR, FRONT_SERVE beserta permission-nya ter-seed.
- Setiap perubahan pada roles/permissions/profiles/employees/system_settings
  otomatis tercatat di audit_logs.
- Tidak ada satu pun secret key di kode yang akan di-commit ke GitHub.

## I. Security consideration
- RLS diaktifkan di **setiap** tabel foundation — tidak ada tabel yang
  "terbuka" secara default (Supabase RLS default deny jika RLS on dan tidak
  ada policy yang cocok).
- `audit_logs` tidak punya policy INSERT untuk client biasa — hanya trigger
  `SECURITY DEFINER` yang bisa menulis, dan tidak ada policy UPDATE/DELETE
  sama sekali → log tidak bisa dihapus/diubah lewat API manapun.
- Kolom `basic_salary` ada di tabel `employees` yang policy-nya membatasi
  akses hanya untuk SUPER_ADMIN/OWNER atau pemilik data sendiri — kasir dan
  front serve **tidak** mendapat policy SELECT sama sekali ke tabel ini,
  sesuai requirement "Kasir tidak boleh melihat payroll".
- `profiles_update_self` mencegah user mengubah `role_id` miliknya sendiri
  (privilege escalation) — hanya SUPER_ADMIN yang bisa lewat policy terpisah.

## J. Next step
Setelah Phase 1 diverifikasi di project DEV (dan Anda konfirmasi hasil test
di atas berjalan benar), kita lanjut ke **Phase 2 — POS Core**: tabel
`orders`, `order_items`, `payments`, `tables`, `categories`, `products`,
beserta service layer (`orderService`, `paymentService`) dan UI kasir dasar.
