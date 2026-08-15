-- ============================================================
-- OMAH KOEMPOEL — Migration 0006: Storage bucket untuk foto produk
-- Bucket dibuat public karena foto menu memang untuk ditampilkan
-- ke publik di digital menu (bukan data sensitif). Hanya
-- SUPER_ADMIN/OWNER yang boleh upload/ubah/hapus filenya.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do nothing;

-- Siapa saja boleh membaca (menu publik butuh ini)
create policy "products_bucket_public_read"
  on storage.objects for select
  using (bucket_id = 'products');

-- Hanya SUPER_ADMIN/OWNER yang boleh upload/ubah/hapus foto produk
create policy "products_bucket_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'products' and public.fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

create policy "products_bucket_admin_update"
  on storage.objects for update
  using (bucket_id = 'products' and public.fn_current_role_code() in ('SUPER_ADMIN','OWNER'));

create policy "products_bucket_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'products' and public.fn_current_role_code() in ('SUPER_ADMIN','OWNER'));
