import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type Station = "kitchen" | "bar";

export type ProductInput = {
  categoryId: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  prepTimeMinutes?: number;
  imageUrl?: string;
  /** Tujuan konfirmasi pesanan: 'kitchen' (makanan) atau 'bar' (minuman).
   * Kalau tidak diisi, ikut default_station kategori yang dipilih. */
  station?: Station;
};

/** Semua fungsi di sini memakai session client (bukan admin) sehingga
 * RLS tetap berlaku: hanya SUPER_ADMIN/OWNER yang bisa berhasil menulis
 * (lihat policy products_manage / categories_manage di Phase 2). Kalau
 * user lain mencoba lewat jalur ini, Supabase akan menolak di database. */

export async function listCatalog() {
  const supabase = createSupabaseServerClient();
  const { data: categories, error: catError } = await supabase
    .from("categories")
    .select("id, name, sort_order, default_station")
    .order("sort_order");
  if (catError) throw new Error(`Gagal memuat kategori: ${catError.message}`);

  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("id, category_id, sku, name, description, price, status, image_url, station")
    .order("name");
  if (prodError) throw new Error(`Gagal memuat produk: ${prodError.message}`);

  return { categories: categories ?? [], products: products ?? [] };
}

export async function createCategory(name: string, sortOrder: number, defaultStation: Station = "kitchen") {
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  const { error } = await supabase
    .from("categories")
    .insert({ business_id: business.id, name, sort_order: sortOrder, default_station: defaultStation });
  if (error) throw new Error(`Gagal menambah kategori: ${error.message}`);
}

export async function createProduct(input: ProductInput) {
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) throw new Error("Business tidak ditemukan.");

  if (input.price < 0) throw new Error("Harga tidak boleh negatif.");

  // Kalau station tidak diisi eksplisit, ikuti default_station kategori
  // yang dipilih — supaya makanan otomatis ke Dapur & minuman ke Bar
  // tanpa Admin perlu set manual setiap tambah produk baru.
  let station: Station = input.station ?? "kitchen";
  if (!input.station) {
    const { data: category } = await supabase
      .from("categories")
      .select("default_station")
      .eq("id", input.categoryId)
      .maybeSingle();
    if (category?.default_station) station = category.default_station as Station;
  }

  const { error } = await supabase.from("products").insert({
    business_id: business.id,
    category_id: input.categoryId,
    sku: input.sku,
    name: input.name,
    description: input.description ?? null,
    price: input.price,
    prep_time_minutes: input.prepTimeMinutes ?? null,
    image_url: input.imageUrl ?? null,
    station,
  });
  if (error) throw new Error(`Gagal menambah produk: ${error.message}`);
}

export async function updateProduct(
  id: string,
  updates: Partial<{
    name: string;
    description: string;
    price: number;
    categoryId: string;
    imageUrl: string;
    station: Station;
  }>
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
      ...(updates.imageUrl !== undefined && { image_url: updates.imageUrl }),
      ...(updates.station !== undefined && { station: updates.station }),
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

/**
 * Upload foto produk ke Supabase Storage (bucket "products") dan simpan
 * URL publiknya ke kolom products.image_url. Memakai session client
 * (bukan admin) supaya storage policy "products_bucket_admin_insert"
 * benar-benar menguji role user yang login — bukan bypass.
 */
export async function uploadProductImage(productId: string, file: File) {
  const supabase = createSupabaseServerClient();

  const maxSizeBytes = 3 * 1024 * 1024; // 3MB, cukup untuk foto menu
  if (file.size > maxSizeBytes) {
    throw new Error("Ukuran foto maksimal 3MB.");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa gambar.");
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${productId}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("products")
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });
  if (uploadError) throw new Error(`Gagal upload foto: ${uploadError.message}`);

  const { data: publicUrlData } = supabase.storage.from("products").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("products")
    .update({ image_url: publicUrlData.publicUrl })
    .eq("id", productId);
  if (updateError) throw new Error(`Gagal menyimpan foto produk: ${updateError.message}`);

  return publicUrlData.publicUrl;
}
