"use server";

import { revalidatePath } from "next/cache";
import * as catalogService from "@/services/catalogService";

export async function createCategoryAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  if (!name) throw new Error("Nama kategori wajib diisi.");
  await catalogService.createCategory(name, sortOrder);
  revalidatePath("/admin/menu");
}

export async function createProductAction(formData: FormData) {
  const categoryId = String(formData.get("categoryId") ?? "");
  const sku = String(formData.get("sku") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);

  if (!categoryId || !sku || !name) throw new Error("Kategori, SKU, dan nama wajib diisi.");

  await catalogService.createProduct({ categoryId, sku, name, description, price });
  revalidatePath("/admin/menu");
  revalidatePath("/");
}

export async function updateProductAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const categoryId = String(formData.get("categoryId") ?? "");

  if (!id) throw new Error("ID produk tidak valid.");

  await catalogService.updateProduct(id, { name, description, price, categoryId });
  revalidatePath("/admin/menu");
  revalidatePath("/");
}

export async function toggleProductStatusAction(id: string, currentStatus: string) {
  const next = currentStatus === "active" ? "inactive" : "active";
  await catalogService.setProductStatus(id, next);
  revalidatePath("/admin/menu");
  revalidatePath("/");
}
