-- ============================================================
-- OMAH KOEMPOEL — Migration 0009: Role Dapur (Omah Mburi) + Realtime KDS
-- ============================================================

-- ----------------------------------------------------------
-- Role baru: KITCHEN ("Omah Mburi" / Dapur)
-- ----------------------------------------------------------
do $$
declare
  v_business_id uuid;
  v_role_kitchen uuid;
begin
  select id into v_business_id from business where name = 'Omah Koempoel' limit 1;

  insert into roles (business_id, code, name, description) values
    (v_business_id, 'KITCHEN', 'Dapur (Omah Mburi)', 'Menerima & memproses pesanan dari kasir/pelanggan')
  on conflict (business_id, code) do nothing;

  select id into v_role_kitchen from roles where business_id = v_business_id and code = 'KITCHEN';

  insert into permissions (code, module, description) values
    ('order.kitchen_process', 'order', 'Memproses status order di dapur (KDS)')
  on conflict (code) do nothing;

  insert into role_permissions (role_id, permission_id)
  select v_role_kitchen, id from permissions
  where code in ('order.view', 'order.kitchen_process')
  on conflict do nothing;
end $$;

-- ----------------------------------------------------------
-- Perluas RLS agar role KITCHEN bisa melihat & mengubah status order
-- (tapi TIDAK bisa memproses pembayaran — policy payments tidak diubah).
-- ----------------------------------------------------------
drop policy if exists orders_select on orders;
create policy orders_select on orders for select
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE','KITCHEN')
  );

drop policy if exists orders_update on orders;
create policy orders_update on orders for update
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE','KITCHEN')
  )
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE','KITCHEN')
  );

drop policy if exists order_items_select on order_items;
create policy order_items_select on order_items for select
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE','KITCHEN')
  );

drop policy if exists order_item_modifiers_select on order_item_modifiers;
create policy order_item_modifiers_select on order_item_modifiers for select
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE','KITCHEN'));

-- ----------------------------------------------------------
-- Aktifkan Supabase Realtime untuk papan pesanan dapur (KDS) live-update
-- ----------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table orders;
exception when duplicate_object then
  null; -- sudah terdaftar, aman diabaikan
end $$;

do $$
begin
  alter publication supabase_realtime add table order_items;
exception when duplicate_object then
  null;
end $$;
