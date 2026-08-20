# Changelog: Akses Captain, Laporan Keuangan, UI Modern, Absensi Pegawai

Ringkasan perubahan. **Wajib jalankan 2 migration baru** sebelum deploy, sisanya
otomatis lewat deploy Next.js seperti biasa.

## 0. Jalankan migration baru (URUT)

```
database/migrations/0016_captain_full_access_and_expense_classification.sql
database/migrations/0017_raw_material_purchases_and_depreciation.sql
```

Keduanya **idempotent** (aman dijalankan ulang). Jalankan lewat Supabase SQL
Editor atau CLI, sama seperti migration 0001–0015 sebelumnya.

## 1. PERBAIKAN BUG: Akses Captain belum jalan

Root cause-nya ada di 3 tempat yang lupa diupdate saat menambah role CAPTAIN
sebelumnya — sudah diperbaiki semua:

- **`LoginForm.tsx`** — sebelumnya semua role selain OWNER/SUPER_ADMIN/KITCHEN/BAR
  diarahkan ke `/pos` tanpa jalan balik ke halaman admin.
- **`PosTopBar.tsx`** — sekarang menampilkan tombol **"📊 Lihat Data"** khusus
  untuk Captain, mengarah ke `/admin` (Laporan, Kelola Menu, Pegawai, Absensi,
  Jadwal Kerja, QR Meja).
- **`kitchen/layout.tsx`** & **`bar/layout.tsx`** — sebelumnya memblokir CAPTAIN
  masuk ke Papan Dapur/Papan Bar (hanya izinkan SUPER_ADMIN/OWNER/KITCHEN atau
  SUPER_ADMIN/OWNER/BAR). Sekarang CAPTAIN diizinkan (view).

**Konfirmasi rule & role Captain saat ini:**
- Rule & role utama: **KASIR** (buka order, tambah item, terima pembayaran,
  kelola meja) — lewat `/pos`.
- Akses **lihat-saja** (view-only, tidak bisa tulis/ubah data): Laporan, Kelola
  Menu, Pegawai, Absensi, Jadwal Kerja, QR Meja, Papan Dapur, Papan Bar.
- Menulis/mengubah data di halaman-halaman tsb tetap terkunci ke SUPER_ADMIN/
  OWNER di level database (RLS) — Captain **wajib koordinasi ke Admin/Owner**
  untuk perubahan teknis operasional apa pun di luar transaksi kasir, sesuai
  arahan terbaru.

## 2. BARU: Belanja Bahan Baku (harian) + rekap harian/mingguan/bulanan

Halaman baru **`/admin/purchases`** ("Belanja Bahan Baku & Aset"):
- Form catat belanja harian: tanggal, nama bahan, qty & satuan (opsional),
  harga/satuan (opsional), **total nominal**, supplier, catatan.
- Rekap otomatis dengan toggle **Harian / Mingguan (Senin–Minggu) / Bulanan**.
- Daftar transaksi lengkap dengan hapus per baris.
- Masuk sebagai komponen **Biaya Operasional** di Laporan Laba Rugi, dihitung
  presisi per hari (bukan estimasi bulanan seperti biaya tetap lain) —
  service: `src/services/rawMaterialService.ts`.
- Captain: **lihat-saja** (form tambah/hapus disembunyikan, tetap bisa lihat
  rekap & daftar).

## 3. BARU: Biaya Penyusutan Aset (standar akuntansi — metode garis lurus)

Di halaman yang sama (`/admin/purchases`), bagian **"Aset Tetap & Biaya
Penyusutan"**:
- Catat aset (nama, kategori, tanggal perolehan, harga perolehan, nilai
  residu, umur manfaat dalam bulan, klasifikasi Operasional/Non-Operasional).
- Penyusutan dihitung **metode garis lurus (straight-line)**, standar
  akuntansi paling umum & mudah diaudit untuk UMKM:

  ```
  Biaya Penyusutan/bulan = (Harga Perolehan − Nilai Residu) ÷ Umur Manfaat (bulan)
  ```

  Dibebankan rata setiap bulan sepanjang umur manfaat aset (mulai bulan
  perolehan, berhenti otomatis setelah umur manfaat habis — tidak akan
  menyusutkan melebihi nilai residu).
- Service: `src/services/depreciationService.ts`.
- Otomatis masuk ke Laporan Laba Rugi sebagai baris "Biaya Penyusutan Aset"
  (operasional atau non-operasional, sesuai klasifikasi tiap aset).

## 4. Laporan Laba Rugi — diperbarui

`src/services/reportService.ts` — `getFinancialStatement()` sekarang:

```
Pendapatan
− Belanja Bahan Baku (harian)
− Biaya Operasional lain (listrik/air/internet/kebersihan/dst)
− Biaya Penyusutan Aset (operasional)
= Laba Kotor
− Biaya Gaji Pegawai
= Laba Operasional
− Biaya Non-Operasional (termasuk penyusutan aset non-operasional)
= Laba Bersih
```

Ditampilkan di `/admin/reports` dengan kartu Laba Kotor/Operasional/Bersih +
tabel rincian, bisa di-export CSV dan dicetak terpisah (pilih "Laporan Laba
Rugi" di dropdown cetak).

**Keterbatasan yang perlu diketahui**: belum ada modul HPP/COGS per-item bahan
baku dari resep — Belanja Bahan Baku dicatat sebagai total pengeluaran kas
periode berjalan (metode kas), bukan dialokasikan otomatis ke penjualan per
produk. Biaya tetap/variabel lain & penyusutan dihitung per bulan kalender
dari tanggal mulai periode; Belanja Bahan Baku presisi per hari.

## 5. Captain — akses aplikasi (dari update sebelumnya, masih berlaku)

- `src/lib/auth.ts`: `requireAdminOrOwner()` mengizinkan `SUPER_ADMIN`,
  `OWNER`, `CAPTAIN` masuk ke halaman admin (baca data). Menulis data tetap
  dibatasi RLS ke SUPER_ADMIN/OWNER.
- `AdminNav.tsx`: Captain melihat menu setara Owner + tombol pintasan "Buka
  Kasir" ke `/pos`. Menu **Kelola User** & **Pengaturan** tetap khusus
  SUPER_ADMIN.

## 6. UI/UX modern (Gen Z, tetap profesional) — dari update sebelumnya

- Design system baru di `globals.css`/`tailwind.config.js`: `.card-modern`,
  `.stat-card-modern`, `.pill-nav-link`, `.btn-primary-modern`,
  `.btn-ghost-modern`, aksen warna teal baru.
- Diterapkan di: Dashboard, Nav, Laporan, Payroll, Absensi Pegawai, dan
  halaman baru Belanja Bahan Baku & Aset.

## Verifikasi yang sudah dilakukan

- `npx tsc --noEmit` → **tidak ada error**.
- `npx next build` → **"Compiled successfully"**; gagal hanya di tahap
  "Collecting page data" karena tidak ada `SUPABASE_SERVICE_ROLE_KEY` asli di
  sandbox ini — bukan bug kode, akan berhasil normal di environment deploy
  dengan kredensial Supabase yang benar.

## Belum dikerjakan / saran lanjutan

- Modernisasi visual halaman Kelola Menu, Pegawai, QR Meja, POS, Kitchen/Bar
  board belum disentuh — bisa lanjut pakai kelas `.card-modern` dkk yang sudah
  tersedia.
- Modul HPP/COGS otomatis dari resep bahan baku (untuk Laba Kotor yang lebih
  akurat secara akuntansi) — disarankan fase berikutnya setelah modul
  Inventory.

