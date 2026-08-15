# PHASE 2 — POS CORE

## A. Tujuan Phase
Membangun inti operasional kasir: meja, katalog produk, order, item order,
dan pembayaran — lengkap dengan penomoran order otomatis, penghitungan
total otomatis, serta penguncian data (immutability) begitu order CLOSED
atau payment COMPLETED, sesuai prinsip Financial Integrity.

## B. File yang dibuat/diubah
```
database/migrations/0003_pos_core_schema.sql
database/migrations/0004_pos_core_rls.sql
database/seed/0002_pos_core_seed.sql
src/lib/supabase-server.ts        (baru — client sesi-aware)
src/services/orderService.ts
src/services/paymentService.ts
src/app/pos/page.tsx
src/app/pos/PosClient.tsx
src/app/pos/actions.ts
package.json                      (+ @supabase/ssr)
```

## C. Database migration
Jalankan berurutan di SQL Editor (DEV dulu):
1. `0003_pos_core_schema.sql`
2. `0004_pos_core_rls.sql`
3. `seed/0002_pos_core_seed.sql`

## D. Source code
Lihat isi file di atas. Alur data: **UI (PosClient) → Server Action
(actions.ts) → Service Layer (orderService/paymentService) → Supabase**,
sesuai Bagian 41 master prompt — tidak ada query database langsung dari
komponen client.

## E. Environment variables
Tidak ada tambahan baru dari Phase 1. Pastikan `NEXT_PUBLIC_SUPABASE_URL`
dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` sudah ada di Vercel.

## F. Cara menjalankan
1. `npm install` (menambah `@supabase/ssr`).
2. Jalankan 3 file SQL di atas.
3. Login sebagai user dengan role KASIR/OWNER/SUPER_ADMIN (perlu ada baris
   di `profiles` dengan `role_id` yang sesuai — pakai akun test dari Phase 1
   atau buat akun staf baru).
4. Buka `/pos` — pilih produk, pilih meja (atau Take Away), Buat Order,
   pilih metode bayar, Bayar & Tutup Order.

## G. Cara testing
- **Alur normal**: buat order 2 item → bayar penuh → pastikan status
  order berubah NEW → PAID → CLOSED, dan baris di `payments` muncul.
- **Split bill (parsial)**: proses pembayaran dengan `amount` kurang dari
  `grand_total` lewat `processPaymentAction` → order harus **tetap** belum
  PAID (masih bisa terima payment lagi).
- **Immutability**: setelah order CLOSED, coba `update orders set notes =
  'test' where id = '...'` langsung di SQL Editor → harus muncul error dari
  `fn_block_closed_order_update`.
- **RLS**: ulangi Test 1 dari Phase 1 (sesi kasir) tapi kali ini terhadap
  tabel `orders` milik business lain (jika ada) → harus kosong.

## H. Expected result
- Order dan pembayaran tercatat akurat dengan `numeric`, bukan `float`.
- Setelah CLOSED, order benar-benar tidak bisa diubah lewat jalur normal
  (hanya lewat mekanisme adjustment/void yang akan dibangun di fase
  Finance mendatang).
- Nomor order otomatis berformat `ORD-YYYYMMDD-0001` dst, reset per hari
  per business.
- Audit log otomatis mencatat setiap perubahan order/payment dengan
  `actor_id` yang benar (karena pakai session client, bukan service role).

## I. Security consideration
- **Tidak ada satu pun operasi POS yang memakai `supabaseAdmin` (service
  role)** — semuanya lewat `supabase-server.ts` yang terikat sesi user
  login, sehingga RLS tetap berlaku penuh dan audit trail akurat.
- Order/payment **tidak punya policy DELETE sama sekali** — transaksi
  finansial tidak bisa dihapus lewat API manapun, sesuai Bagian 74 poin 7.
- CLOSED order dan COMPLETED payment diblokir dari UPDATE oleh **trigger
  database**, bukan hanya validasi di service layer — jadi tetap aman
  walau ada bug di kode aplikasi atau seseorang mengakses API langsung.
- Ordering publik (tanpa login, lewat QR) **sengaja belum dihubungkan**
  di fase ini — akan dibangun di fase Public Website dengan validasi ketat
  di server, bukan lewat policy anon langsung ke tabel `orders`.

## J. Next step
Setelah Phase 2 diverifikasi (alur order → bayar → closed berjalan benar
di `/pos`), lanjut ke **Phase 3 — Kitchen & Service**: tampilan Kitchen
Display System (KDS) yang membaca `order_items` real-time via Supabase
Realtime, dan update status meja otomatis mengikuti siklus order.
