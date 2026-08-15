-- ============================================================
-- OMAH KOEMPOEL — Migration 0004: POS Core RLS Policies
-- Run AFTER 0003_pos_core_schema.sql
--
-- Design decision: order/payment writes from the customer-facing
-- (public, unauthenticated) ordering flow are NOT done via direct
-- anon RLS policies. They go through a server-side service layer
-- using the admin client, which performs its own validation before
-- writing. This keeps the trust boundary at the server, matching
-- Master Prompt Bagian 28/41 ("jangan hanya menyembunyikan di UI",
-- "pisahkan UI -> Service Layer -> Database"). Public ordering will
-- be wired up when the Public Website phase is built.
-- ============================================================

alter table table_areas enable row level security;
alter table tables enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table product_modifiers enable row level security;
alter table order_number_counters enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table order_item_modifiers enable row level security;
alter table payment_methods enable row level security;
alter table payments enable row level security;

-- ----------------------------------------------------------
-- CATALOG: public read (needed for digital menu), staff-only write
-- ----------------------------------------------------------
create policy table_areas_select on table_areas for select using (true);
create policy table_areas_manage on table_areas for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

create policy tables_select on tables for select using (true);
create policy tables_manage on tables for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE'));

create policy categories_select on categories for select using (true);
create policy categories_manage on categories for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

create policy products_select on products for select using (status = 'active' or fn_current_role_code() is not null);
create policy products_manage on products for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

create policy product_variants_select on product_variants for select using (true);
create policy product_variants_manage on product_variants for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

create policy product_modifiers_select on product_modifiers for select using (true);
create policy product_modifiers_manage on product_modifiers for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

create policy payment_methods_select on payment_methods for select using (true);
create policy payment_methods_manage on payment_methods for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

-- ----------------------------------------------------------
-- ORDERS: staff-only. No DELETE policy for anyone (immutable ledger).
-- UPDATE is further restricted at the row level by
-- fn_block_closed_order_update() regardless of role.
-- ----------------------------------------------------------
create policy orders_select on orders for select
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE')
  );

create policy orders_insert on orders for insert
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE')
  );

create policy orders_update on orders for update
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE')
  )
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE')
  );

create policy order_items_select on order_items for select
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE')
  );

create policy order_items_insert on order_items for insert
  with check (
    fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE')
  );

create policy order_items_update on order_items for update
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE')
  )
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE')
  );

create policy order_item_modifiers_select on order_item_modifiers for select
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE'));

create policy order_item_modifiers_insert on order_item_modifiers for insert
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE'));

-- ----------------------------------------------------------
-- PAYMENTS: KASIR/OWNER/SUPER_ADMIN only. No DELETE policy (immutable).
-- UPDATE is further restricted by fn_block_completed_payment_update().
-- ----------------------------------------------------------
create policy payments_select on payments for select
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR')
  );

create policy payments_insert on payments for insert
  with check (
    fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR')
  );

create policy payments_update on payments for update
  using (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER')
  )
  with check (
    business_id = fn_current_business_id()
    and fn_current_role_code() in ('SUPER_ADMIN','OWNER')
  );

-- order_number_counters: no client access needed at all, only the
-- SECURITY INVOKER function fn_next_order_number touches it as the
-- calling (staff) user, so staff roles need INSERT/UPDATE via the policy.
create policy order_number_counters_rw on order_number_counters for all
  using (fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE'))
  with check (fn_current_role_code() in ('SUPER_ADMIN','OWNER','KASIR','FRONT_SERVE'));
