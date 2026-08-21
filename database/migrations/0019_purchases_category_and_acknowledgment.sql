-- ============================================================
-- OMAH KOEMPOEL — Migration 0019: Kategori Belanja + Alur "Diketahui"
--   Captain sekarang bisa MENCATAT belanja — bukan cuma bahan baku,
--   tapi juga penggantian peralatan/perlengkapan & belanja rutin
--   lainnya yang dibutuhkan Kedai — dan catatan itu perlu "diketahui"
--   (di-acknowledge) oleh Admin/Owner. Mencatat = insert saja untuk
--   Captain (tidak bisa ubah/hapus catatan orang lain — supaya jejak
--   akuntabel tetap utuh); acknowledge/ubah/hapus tetap wewenang
--   SUPER_ADMIN/OWNER.
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

alter table raw_material_purchases
  add column if not exists category text not null default 'bahan_baku'
  check (category in ('bahan_baku', 'peralatan_perlengkapan', 'rutin_lainnya'));

comment on column raw_material_purchases.category is
  'bahan_baku = belanja bahan baku harian; peralatan_perlengkapan = penggantian peralatan/perlengkapan kedai; rutin_lainnya = belanja rutin lain yang dibutuhkan kedai.';

alter table raw_material_purchases
  add column if not exists acknowledged_by uuid references profiles(id);
alter table raw_material_purchases
  add column if not exists acknowledged_at timestamptz;

comment on column raw_material_purchases.acknowledged_by is
  'Diisi saat Admin/Owner menandai catatan belanja ini sudah "diketahui" — supaya semua belanja yang dicatat Captain tetap transparan & terpantau, walau tidak butuh approval sebelum dicatat.';

create index if not exists idx_raw_material_purchases_category on raw_material_purchases (business_id, category);

-- Captain: boleh INSERT (mencatat belanja baru) dan tetap bisa SELECT
-- (sudah ada dari 0017). Update/delete/acknowledge tetap wewenang
-- SUPER_ADMIN/OWNER lewat raw_material_purchases_manage yang sudah ada.
drop policy if exists raw_material_purchases_captain_insert on raw_material_purchases;
create policy raw_material_purchases_captain_insert on raw_material_purchases for insert
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() = 'CAPTAIN'
  );
