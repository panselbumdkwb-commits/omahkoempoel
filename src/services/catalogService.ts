import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type ProductInput = {
  categoryId: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  prepTimeMinutes?: number;
};

/** Semua fungsi di sini memakai session client (bukan admin) sehingga
 * RLS tetap berlaku: hanya SUPER_ADMIN/OWNER yang bisa berhasil menulis
 * (lihat policy products_manage / categories_manage di Phase 2). Kalau
 * user lain mencoba lewat jalur ini, Supabase akan menolak di database. */

export async function listCatalog() {
  const supabase = createSupabaseServerClient();
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .order("sort_order");
  if (catError) throw new Error(`Gagal memuat kategori: ${catError.message}`);

  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("id, category_id, sku, name, description, price, status")
    .order("name");
  if (prodError) throw new Error(`Gagal memuat produk: ${prodError.message}`);

  return { categories: categories ?? [], products: products ?? [] };
}

export async function createCategory(name: string, sortOrder: number) {
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { error } = await supabase
    .from("categories")
    .insert({ business_id: business.id, name, sort_order: sortOrder });
  if (error) throw new Error(`Gagal menambah kategori: ${error.message}`);
}

export async function createProduct(input: ProductInput) {
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  if (input.price < 0) throw new Error("Harga tidak boleh negatif.");

  const { error } = await supabase.from("products").insert({
    business_id: business.id,
    category_id: input.categoryId,
    sku: input.sku,
    name: input.name,
    description: input.description ?? null,
    price: input.price,
    prep_time_minutes: input.prepTimeMinutes ?? null,
  });
  if (error) throw new Error(`Gagal menambah produk: ${error.message}`);
}

export async function updateProduct(
  id: string,
  updates: Partial<{ name: string; description: string; price: number; categoryId: string }>
) {
  const supabase = createSupabaseServerClient();
  if (updates.price !== undefined && updates.price < 0) {
    throw new Error("Harga tidak boleh negatif.");
  }

  const { error } = await supabase
    .from("products")
    .update({
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.price !== undefined && { price: updates.price }),
      ...(updates.categoryId !== undefined && { category_id: updates.categoryId }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`Gagal memperbarui produk: ${error.message}`);
}

/** Menonaktifkan/mengaktifkan produk. Sengaja TIDAK hard delete — produk
 * yang pernah dipesan harus tetap ada demi integritas laporan historis
 * (Master Prompt Bagian 74 poin 7). "Hapus" dari sisi konsumen cukup lewat
 * status inactive, yang otomatis menyembunyikannya dari digital menu. */
export async function setProductStatus(id: string, status: "active" | "inactive") {
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("products").update({ status }).eq("id", id);
  if (error) throw new Error(`Gagal mengubah status produk: ${error.message}`);
}
