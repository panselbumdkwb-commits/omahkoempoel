-- ============================================================
-- OMAH KOEMPOEL — Migration 0017: Belanja Bahan Baku (harian) &
-- Aset Tetap + Biaya Penyusutan (metode garis lurus / straight-line,
-- standar pencatatan akuntansi umum untuk UMKM — PSAK 16 disederhanakan).
-- Idempotent: aman dijalankan berkali-kali.
-- ============================================================

-- ----------------------------------------------------------
-- A. BELANJA BAHAN BAKU — dicatat harian (bukan bulanan seperti
--    Listrik/Air), karena belanja pasar/supplier terjadi tiap hari
--    dan nominalnya beda-beda. Termasuk Biaya Operasional inti di
--    Laporan Laba Rugi, direkap harian/mingguan/bulanan bersama
--    biaya operasional lainnya.
-- ----------------------------------------------------------
create table if not exists raw_material_purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  purchase_date date not null,
  item_name text not null,
  quantity numeric(12,2),
  unit text,
  unit_price numeric(14,2),
  amount numeric(14,2) not null check (amount >= 0),
  supplier text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

comment on table raw_material_purchases is
  'Belanja bahan baku harian (mis. sayur, daging, kopi, susu, kemasan). amount = total nominal belanja hari itu untuk 1 item/nota; quantity/unit/unit_price opsional untuk detail (bisa dikosongkan kalau catatan nota gabungan).';

create index if not exists idx_raw_material_purchases_date on raw_material_purchases (business_id, purchase_date);

alter table raw_material_purchases enable row level security;

drop policy if exists raw_material_purchases_select on raw_material_purchases;
create policy raw_material_purchases_select on raw_material_purchases for select
  using (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'));

drop policy if exists raw_material_purchases_manage on raw_material_purchases;
create policy raw_material_purchases_manage on raw_material_purchases for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

drop trigger if exists trg_audit_raw_material_purchases on raw_material_purchases;
create trigger trg_audit_raw_material_purchases after insert or update or delete on raw_material_purchases
  for each row execute function fn_audit_trigger();

-- ----------------------------------------------------------
-- B. ASET TETAP & PENYUSUTAN (metode garis lurus):
--    Biaya Penyusutan/bulan = (Harga Perolehan − Nilai Residu) / Umur
--    Manfaat (bulan). Ini standar akuntansi paling umum & paling
--    mudah diaudit untuk UMKM (dibanding saldo menurun/unit produksi).
-- ----------------------------------------------------------
create table if not exists fixed_assets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  name text not null,
  category text not null default 'equipment' check (category in ('equipment','furniture','vehicle','building','other')),
  acquisition_date date not null,
  acquisition_cost numeric(14,2) not null check (acquisition_cost >= 0),
  residual_value numeric(14,2) not null default 0 check (residual_value >= 0),
  useful_life_months integer not null check (useful_life_months > 0),
  expense_type text not null default 'operational' check (expense_type in ('operational','non_operational')),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table fixed_assets is
  'Aset tetap (mesin espresso, kulkas, meja-kursi, kendaraan, dll) untuk perhitungan Biaya Penyusutan bulanan metode garis lurus di Laporan Laba Rugi.';
comment on column fixed_assets.residual_value is
  'Nilai sisa/residu di akhir umur manfaat (boleh 0 jika diperkirakan tidak ada nilai jual kembali).';
comment on column fixed_assets.expense_type is
  'Klasifikasi penyusutan aset ini di Laporan Laba Rugi: operational (aset operasional cafe) atau non_operational (aset di luar operasional inti).';

alter table fixed_assets enable row level security;

drop policy if exists fixed_assets_select on fixed_assets;
create policy fixed_assets_select on fixed_assets for select
  using (business_id = fn_current_business_id() and fn_current_role_code() in ('SUPER_ADMIN','OWNER','CAPTAIN'));

drop policy if exists fixed_assets_manage on fixed_assets;
create policy fixed_assets_manage on fixed_assets for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

drop trigger if exists trg_audit_fixed_assets on fixed_assets;
create trigger trg_audit_fixed_assets after insert or update or delete on fixed_assets
  for each row execute function fn_audit_trigger();
