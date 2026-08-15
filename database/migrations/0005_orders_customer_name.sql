-- ============================================================
-- OMAH KOEMPOEL — Migration 0005: customer_name on orders
-- Kasir perlu mencatat nama pelanggan saat memproses order masuk,
-- tanpa perlu modul Customer/CRM penuh dulu (menyusul di fase lain).
-- ============================================================

alter table orders add column if not exists customer_name text;
