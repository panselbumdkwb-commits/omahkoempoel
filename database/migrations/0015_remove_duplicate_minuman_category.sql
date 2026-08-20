-- ============================================================
-- OMAH KOEMPOEL — Migration 0015: Hapus Kategori "Minuman" Lama
-- (Duplikat — sudah digantikan sub-kategori "Minuman - Signature
-- Drink / Wedang / Teh & Rempah / Kopi / Nenen & Susu" dari seed
-- 0003.) Produk yang MASIH ada di kategori "Minuman" lama (mis. dari
-- seed awal 0002 — Es Teh Koempoel, Kopi Susu Gula Aren, Es Jeruk
-- Peras — yang punya harga ASLI, bukan placeholder Rp0) DIPINDAH dulu
-- ke sub-kategori yang paling sesuai berdasarkan nama produk, supaya
-- tidak hilang dari tab kategori di menu digital, baru kategori lama
-- dihapus. Idempotent: aman dijalankan berkali-kali.
-- ============================================================

do $$
declare
  v_business_id uuid;
  v_old_minuman_id uuid;
  v_cat_teh uuid;
  v_cat_kop uuid;
  v_cat_sus uuid;
  v_cat_sig uuid;
  v_cat_catchall uuid;
  v_moved_count int;
begin
  select id into v_business_id from business where name = 'Omah Koempoel' limit 1;
  if v_business_id is null then
    return;
  end if;

  -- Kategori "Minuman" lama = nama PERSIS "Minuman" (bukan yang diawali
  -- "Minuman - ...", itu sub-kategori baru yang TIDAK disentuh).
  select id into v_old_minuman_id from categories
    where business_id = v_business_id and name = 'Minuman'
    limit 1;

  if v_old_minuman_id is null then
    -- Sudah tidak ada (mis. migration ini sudah pernah jalan) — tidak
    -- ada yang perlu dilakukan.
    return;
  end if;

  select id into v_cat_teh from categories where business_id = v_business_id and name = 'Minuman - Teh & Rempah' limit 1;
  select id into v_cat_kop from categories where business_id = v_business_id and name = 'Minuman - Kopi' limit 1;
  select id into v_cat_sus from categories where business_id = v_business_id and name = 'Minuman - Nenen & Susu' limit 1;
  select id into v_cat_sig from categories where business_id = v_business_id and name = 'Minuman - Signature Drink' limit 1;

  -- Kalau sub-kategori barunya belum ada (seed 0003 belum pernah
  -- dijalankan), jangan hapus kategori lama — lebih aman berhenti di
  -- sini daripada produk jadi tanpa kategori sama sekali.
  if v_cat_teh is null or v_cat_kop is null or v_cat_sus is null or v_cat_sig is null then
    raise notice 'Sub-kategori Minuman baru belum lengkap (jalankan seed 0003 dulu) — kategori "Minuman" lama TIDAK dihapus.';
    return;
  end if;

  -- Kategori penampung untuk produk yang tidak jelas cocok ke sub-
  -- kategori manapun berdasarkan nama (jaga-jaga, supaya tidak ada
  -- produk yang hilang dari tab kategori).
  select id into v_cat_catchall from categories where business_id = v_business_id and name = 'Minuman - Lain-Lain' limit 1;
  if v_cat_catchall is null then
    insert into categories (business_id, name, sort_order, default_station)
    values (v_business_id, 'Minuman - Lain-Lain', 26, 'bar')
    returning id into v_cat_catchall;
  end if;

  -- Pindahkan produk berdasarkan kata kunci di nama — kopi ke Kopi,
  -- teh/jeruk ke Teh & Rempah, susu/nenen ke Nenen & Susu, sisanya ke
  -- Lain-Lain (bukan dihapus, bukan dibiarkan tanpa kategori).
  update products set category_id = v_cat_kop
    where business_id = v_business_id and category_id = v_old_minuman_id and lower(name) like '%kopi%';
  update products set category_id = v_cat_teh
    where business_id = v_business_id and category_id = v_old_minuman_id
      and (lower(name) like '%teh%' or lower(name) like '%jeruk%');
  update products set category_id = v_cat_sus
    where business_id = v_business_id and category_id = v_old_minuman_id
      and (lower(name) like '%susu%' or lower(name) like '%nenen%');
  update products set category_id = v_cat_catchall
    where business_id = v_business_id and category_id = v_old_minuman_id;

  -- Pastikan station-nya ikut 'bar' (produk lama ini kemungkinan masih
  -- 'kitchen' bawaan default sebelum migration 0011 menambah kolom
  -- station) supaya tetap muncul di Papan Bar, bukan Papan Dapur.
  update products set station = 'bar'
    where business_id = v_business_id and category_id in (v_cat_kop, v_cat_teh, v_cat_sus, v_cat_catchall)
      and station <> 'bar';

  select count(*) into v_moved_count from products where category_id = v_old_minuman_id;
  if v_moved_count = 0 then
    delete from categories where id = v_old_minuman_id;
  else
    raise notice 'Masih ada % produk di kategori "Minuman" lama yang gagal dipindah — kategori TIDAK dihapus, cek manual.', v_moved_count;
  end if;
end $$;
