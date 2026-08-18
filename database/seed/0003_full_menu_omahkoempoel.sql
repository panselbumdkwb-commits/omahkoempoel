-- ============================================================
-- OMAH KOEMPOEL — Seed 0003: Full Menu (dari poster menu terbaru)
-- Mengisi seluruh item menu ke tabel categories + products, dipisah
-- menjadi 2 kelompok besar sesuai routing dapur/bar (kolom `station`,
-- lihat migration 0011):
--   - KITCHEN: kategori "Makanan" (Nasi Sambal + Makanan Berat/Mie) dan
--     "Snack" (Camilan + Tambahan)
--   - BAR: kategori "Minuman - ..." (Signature Drink, Wedang, Teh &
--     Rempah, Kopi, Nenen & Susu)
--
-- Item yang muncul dua kali di poster (cetak ulang ringkas di bagian
-- bawah) DIGABUNG jadi satu produk saja. Item yang sudah ada dari seed
-- 0002 (mis. "Nasi Goreng Koempoel") TIDAK ditambahkan ulang — dicek
-- pakai NOT EXISTS berdasarkan nama (case-insensitive) supaya aman
-- dijalankan berkali-kali (idempotent) dan tidak membuat data ganda.
--
-- CATATAN HARGA: poster menu yang dipakai sebagai sumber tidak
-- mencantumkan harga per item, jadi seluruh produk baru di bawah ini
-- diisi price = 0 sebagai placeholder. Harga WAJIB diisi manual lewat
-- halaman Admin > Kelola Menu sebelum dipakai di kasir/POS.
-- Run AFTER 0001 & 0002 (seed) dan 0011 (migration, kolom station).
-- ============================================================

do $$
declare
  v_business_id uuid;

  v_cat_makanan uuid;   -- existing, station kitchen
  v_cat_snack   uuid;   -- existing, station kitchen

  v_cat_sig uuid;  -- Minuman - Signature Drink (bar)
  v_cat_wed uuid;  -- Minuman - Wedang (bar)
  v_cat_teh uuid;  -- Minuman - Teh & Rempah (bar)
  v_cat_kop uuid;  -- Minuman - Kopi (bar)
  v_cat_sus uuid;  -- Minuman - Nenen & Susu (bar)
begin
  select id into v_business_id from business where name = 'Omah Koempoel' limit 1;
  if v_business_id is null then
    raise exception 'Business "Omah Koempoel" tidak ditemukan — jalankan seed 0001/0002 dulu.';
  end if;

  -- ----------------------------------------------------------
  -- Kategori KITCHEN (pakai yang sudah ada dari seed 0002)
  -- ----------------------------------------------------------
  select id into v_cat_makanan from categories where business_id = v_business_id and name = 'Makanan' limit 1;
  select id into v_cat_snack   from categories where business_id = v_business_id and name = 'Snack' limit 1;

  -- ----------------------------------------------------------
  -- Kategori BAR baru (minuman dipecah per kelompok poster supaya
  -- mudah dicari di kasir; semuanya default_station = 'bar')
  -- ----------------------------------------------------------
  insert into categories (business_id, name, sort_order, default_station)
  select v_business_id, x.name, x.sort_order, 'bar'
  from (values
    ('Minuman - Signature Drink', 20),
    ('Minuman - Wedang', 21),
    ('Minuman - Teh & Rempah', 22),
    ('Minuman - Kopi', 23),
    ('Minuman - Nenen & Susu', 24)
  ) as x(name, sort_order)
  where not exists (
    select 1 from categories c where c.business_id = v_business_id and c.name = x.name
  );

  select id into v_cat_sig from categories where business_id = v_business_id and name = 'Minuman - Signature Drink' limit 1;
  select id into v_cat_wed from categories where business_id = v_business_id and name = 'Minuman - Wedang' limit 1;
  select id into v_cat_teh from categories where business_id = v_business_id and name = 'Minuman - Teh & Rempah' limit 1;
  select id into v_cat_kop from categories where business_id = v_business_id and name = 'Minuman - Kopi' limit 1;
  select id into v_cat_sus from categories where business_id = v_business_id and name = 'Minuman - Nenen & Susu' limit 1;

  -- ============================================================
  -- KITCHEN — Makanan (Nasi Sambal + Makanan Berat/Mie)
  -- ============================================================
  insert into products (business_id, category_id, sku, name, description, price, station)
  select v_business_id, v_cat_makanan, x.sku, x.name, x.description, 0, 'kitchen'
  from (values
    ('MKN-004', 'Nasi Sambal Telur Dadar', 'Nasi sambal dengan telur dadar'),
    ('MKN-005', 'Nasi Sambal Ati Ampela', 'Nasi sambal dengan ati ampela'),
    ('MKN-006', 'Nasi Sambal Tahu, Tempe dan Terong', 'Nasi sambal dengan tahu, tempe, dan terong'),
    ('MKN-007', 'Nasi Sambal Ayam Goreng', 'Nasi sambal dengan ayam goreng'),
    ('MKN-008', 'Nasi Goreng Gila', 'Nasi goreng khas omah koempoel dengan rasa pedas yang unik'),
    ('MKN-009', 'Nasi Pecel', 'Nasi, aneka sayuran, tempe mendoan dan telur dengan saus kacang'),
    ('MKN-010', 'Soto Ayam', 'Kuah yang melimpah dan segar ditambah ayam, dan nasi'),
    ('MKN-011', 'Nasi Mangkok Teriyaki', 'Nasi, chicken katsu, chicken nugget, kentang, sayuran, dengan saus teriyaki'),
    ('MKN-012', 'Nasi Mangkok Black Pepper', 'Nasi, chicken nugget, sosis, kentang, sayuran, dengan saus black pepper'),
    ('MKN-013', 'Nasi Ayam Sambel Brantas', 'Lalapan ayam lengkap dengan sayuran dan nasi'),
    ('MKN-014', 'Nasi Goreng Jawa', 'Nasi goreng khas omah koempoel dengan cita rasa manis'),
    ('MKN-015', 'Mie Goreng Koempoel', null),
    ('MKN-016', 'Mie Godhog Koempoel', null)
  ) as x(sku, name, description)
  where not exists (
    select 1 from products p where p.business_id = v_business_id
      and (lower(p.name) = lower(x.name) or p.sku = x.sku)
  )
  on conflict (business_id, sku) do nothing;

  -- ============================================================
  -- KITCHEN — Snack (Camilan + Tambahan)
  -- ============================================================
  insert into products (business_id, category_id, sku, name, description, price, station)
  select v_business_id, v_cat_snack, x.sku, x.name, x.description, 0, 'kitchen'
  from (values
    ('SNK-003', 'Cireng', 'Berisi 6 biji cireng dengan saus spesial'),
    ('SNK-004', 'Tempe Mendoan', 'Disantap selagi panas'),
    ('SNK-005', 'Mix Snack', 'Kombinasi antara sosis, cireng, nugget, kentang, dan tempura'),
    ('SNK-006', 'Roti Bakar', null),
    ('SNK-007', 'Tahu Petis', null),
    ('SNK-008', 'Tahu Melotot', null),
    ('SNK-009', 'Donat', null),
    ('SNK-010', 'Lumpia', null),
    ('SNK-011', 'Kentang Goreng', null),
    ('SNK-012', 'Risol Mayo', null),
    ('SNK-013', 'Layer Cake', null),
    ('SNK-014', 'Tambahan Nasi', 'Nasi putih tambahan'),
    ('SNK-015', 'Tambahan Telur', 'Telur tambahan'),
    ('SNK-016', 'Tambahan Sambal', 'Sambal tambahan')
  ) as x(sku, name, description)
  where not exists (
    select 1 from products p where p.business_id = v_business_id
      and (lower(p.name) = lower(x.name) or p.sku = x.sku)
  )
  on conflict (business_id, sku) do nothing;

  -- ============================================================
  -- BAR — Signature Drink
  -- ============================================================
  insert into products (business_id, category_id, sku, name, description, price, station)
  select v_business_id, v_cat_sig, x.sku, x.name, x.description, 0, 'bar'
  from (values
    ('SIG-001', 'Soklat Koempoel', 'Dark coklat'),
    ('SIG-002', 'Nenen Koempoel', 'Mix, susu, coklat dan strawberry'),
    ('SIG-003', 'Tirto Cinde', 'Mint, teh, jeruk nipis dan strobery'),
    ('SIG-004', 'Tirto Umbul', 'Jahe, madu, jeruk nipis'),
    ('SIG-005', 'Tirto Banyuning', 'Mix, teh, jeruk nipis, mint, madu')
  ) as x(sku, name, description)
  where not exists (
    select 1 from products p where p.business_id = v_business_id
      and (lower(p.name) = lower(x.name) or p.sku = x.sku)
  )
  on conflict (business_id, sku) do nothing;

  -- ============================================================
  -- BAR — Wedang
  -- ============================================================
  insert into products (business_id, category_id, sku, name, description, price, station)
  select v_business_id, v_cat_wed, x.sku, x.name, x.description, 0, 'bar'
  from (values
    ('WED-001', 'Wedang Sembarang', 'Minuman yang dibuat secara random oleh barista / "sak karep e seng gawe"')
  ) as x(sku, name, description)
  where not exists (
    select 1 from products p where p.business_id = v_business_id
      and (lower(p.name) = lower(x.name) or p.sku = x.sku)
  )
  on conflict (business_id, sku) do nothing;

  -- ============================================================
  -- BAR — Teh & Rempah (Tea/Teh + Lain-Lain rempah)
  -- ============================================================
  insert into products (business_id, category_id, sku, name, description, price, station)
  select v_business_id, v_cat_teh, x.sku, x.name, x.description, 0, 'bar'
  from (values
    ('TEH-001', 'Teh Tubruk', null),
    ('TEH-002', 'Teh Jeruk', null),
    ('TEH-003', 'Teh Jahe', null),
    ('TEH-004', 'Teh Tarik', null),
    ('TEH-005', 'Jahe', null),
    ('TEH-006', 'Jeruk', null),
    ('TEH-007', 'Tape', null),
    ('TEH-008', 'Tomat', null),
    ('TEH-009', 'Rempah', null),
    ('TEH-010', 'Jeruk Nipis Madu', null),
    ('TEH-011', 'Kapiten', null)
  ) as x(sku, name, description)
  where not exists (
    select 1 from products p where p.business_id = v_business_id
      and (lower(p.name) = lower(x.name) or p.sku = x.sku)
  )
  on conflict (business_id, sku) do nothing;

  -- ============================================================
  -- BAR — Kopi (Coffee/Kopi + E/Kopi + Kopi Koempoel)
  -- ============================================================
  insert into products (business_id, category_id, sku, name, description, price, station)
  select v_business_id, v_cat_kop, x.sku, x.name, x.description, 0, 'bar'
  from (values
    ('KOP-001', 'Tubruk Robusta', null),
    ('KOP-002', 'Tubruk Arabika', null),
    ('KOP-003', 'Vietnam Drips', null),
    ('KOP-004', 'Espresso', 'Dengan kopi lokal (house blend)'),
    ('KOP-005', 'Americano', 'Lokal house blend'),
    ('KOP-006', 'V60', 'Kopi saring dengan pilihan roast beans lokal'),
    ('KOP-007', 'Obusta', 'Es kopi tubruk robusta'),
    ('KOP-008', 'Rabika', 'Es kopi tubruk arabika'),
    ('KOP-009', 'Rips', 'Es kopi V60 / drip'),
    ('KOP-010', 'Es Kopi Susu', 'Espresso, kreamer'),
    ('KOP-011', 'Kopi Pagi', 'Kopi dan skm'),
    ('KOP-012', 'Kopi Sore', 'Espresso, coklat, skm'),
    ('KOP-013', 'Kopi Malam', 'Kopi, susu murni, skm'),
    ('KOP-014', 'Cappucino', null),
    ('KOP-015', 'Kopi Koempoel', 'Espresso, susu murni')
  ) as x(sku, name, description)
  where not exists (
    select 1 from products p where p.business_id = v_business_id
      and (lower(p.name) = lower(x.name) or p.sku = x.sku)
  )
  on conflict (business_id, sku) do nothing;

  -- ============================================================
  -- BAR — Nenen & Susu
  -- ============================================================
  insert into products (business_id, category_id, sku, name, description, price, station)
  select v_business_id, v_cat_sus, x.sku, x.name, x.description, 0, 'bar'
  from (values
    ('SUS-001', 'Nenen Asli', null),
    ('SUS-002', 'Nenen Strobery', null),
    ('SUS-003', 'Nenen Moca', null),
    ('SUS-004', 'Nenen Matcha', null),
    ('SUS-005', 'Nenen Soklat', null),
    ('SUS-006', 'Nenen Tape', null),
    ('SUS-007', 'Nenen Tomat', null),
    ('SUS-008', 'Coksutap', 'Mix, coklat, susu dan tape'),
    ('SUS-009', 'Susu Madu Jahe', null)
  ) as x(sku, name, description)
  where not exists (
    select 1 from products p where p.business_id = v_business_id
      and (lower(p.name) = lower(x.name) or p.sku = x.sku)
  )
  on conflict (business_id, sku) do nothing;

end $$;
