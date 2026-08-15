-- ============================================================
-- OMAH KOEMPOEL — Seed: POS Core (payment methods, tables, catalog)
-- Run on DEV first.
-- ============================================================

do $$
declare
  v_business_id uuid;
  v_area_indoor uuid;
  v_area_outdoor uuid;
  v_cat_makanan uuid;
  v_cat_minuman uuid;
  v_cat_snack uuid;
begin
  select id into v_business_id from business where name = 'Omah Koempoel' limit 1;

  -- Payment methods
  insert into payment_methods (business_id, code, name, type) values
    (v_business_id, 'cash', 'Cash', 'cash'),
    (v_business_id, 'qris', 'QRIS', 'qris'),
    (v_business_id, 'transfer', 'Bank Transfer', 'bank_transfer'),
    (v_business_id, 'edc', 'EDC', 'edc')
  on conflict (business_id, code) do nothing;

  -- Table areas
  insert into table_areas (business_id, name) values
    (v_business_id, 'Indoor'), (v_business_id, 'Outdoor')
  on conflict do nothing;

  select id into v_area_indoor from table_areas where business_id = v_business_id and name = 'Indoor' limit 1;
  select id into v_area_outdoor from table_areas where business_id = v_business_id and name = 'Outdoor' limit 1;

  -- 10 tables (6 indoor, 4 outdoor)
  insert into tables (business_id, area_id, number, capacity) values
    (v_business_id, v_area_indoor, 'A1', 2), (v_business_id, v_area_indoor, 'A2', 2),
    (v_business_id, v_area_indoor, 'A3', 4), (v_business_id, v_area_indoor, 'A4', 4),
    (v_business_id, v_area_indoor, 'A5', 6), (v_business_id, v_area_indoor, 'A6', 2),
    (v_business_id, v_area_outdoor, 'B1', 2), (v_business_id, v_area_outdoor, 'B2', 4),
    (v_business_id, v_area_outdoor, 'B3', 4), (v_business_id, v_area_outdoor, 'B4', 6)
  on conflict (business_id, number) do nothing;

  -- Categories
  insert into categories (business_id, name, sort_order) values
    (v_business_id, 'Makanan', 1), (v_business_id, 'Minuman', 2), (v_business_id, 'Snack', 3)
  on conflict do nothing;

  select id into v_cat_makanan from categories where business_id = v_business_id and name = 'Makanan' limit 1;
  select id into v_cat_minuman from categories where business_id = v_business_id and name = 'Minuman' limit 1;
  select id into v_cat_snack from categories where business_id = v_business_id and name = 'Snack' limit 1;

  -- Sample products
  insert into products (business_id, category_id, sku, name, price, prep_time_minutes) values
    (v_business_id, v_cat_makanan, 'MKN-001', 'Nasi Goreng Koempoel', 28000, 15),
    (v_business_id, v_cat_makanan, 'MKN-002', 'Ayam Geprek Sambal Korek', 26000, 15),
    (v_business_id, v_cat_makanan, 'MKN-003', 'Mie Godog Jawa', 24000, 12),
    (v_business_id, v_cat_minuman, 'MIN-001', 'Es Teh Koempoel', 8000, 5),
    (v_business_id, v_cat_minuman, 'MIN-002', 'Kopi Susu Gula Aren', 18000, 7),
    (v_business_id, v_cat_minuman, 'MIN-003', 'Es Jeruk Peras', 10000, 5),
    (v_business_id, v_cat_snack, 'SNK-001', 'Pisang Goreng Keju', 15000, 10),
    (v_business_id, v_cat_snack, 'SNK-002', 'Tahu Crispy', 13000, 10)
  on conflict (business_id, sku) do nothing;
end $$;

-- Modifiers for Es Teh Koempoel (example from master prompt)
-- Note: no unique constraint on product_modifiers, so this seed is
-- safe to run only ONCE. Re-running will duplicate modifier rows.
insert into product_modifiers (product_id, name, price_adjustment)
select id, m.name, 0
from products p, (values ('Normal'), ('Less Sugar'), ('No Sugar'), ('Extra Ice')) as m(name)
where p.sku = 'MIN-001'
and not exists (select 1 from product_modifiers pm where pm.product_id = p.id);

-- Add-ons for Nasi Goreng Koempoel (example from master prompt)
insert into product_modifiers (product_id, name, price_adjustment)
select id, m.name, m.price
from products p, (values ('Telur', 5000), ('Ayam', 8000), ('Sosis', 6000), ('Extra Sambal', 2000)) as m(name, price)
where p.sku = 'MKN-001'
and not exists (select 1 from product_modifiers pm where pm.product_id = p.id);
