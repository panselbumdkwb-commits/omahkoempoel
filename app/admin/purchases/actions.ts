"use server";

import { revalidatePath } from "next/cache";
import * as rawMaterialService from "@/services/rawMaterialService";
import * as depreciationService from "@/services/depreciationService";

export async function createPurchaseAction(formData: FormData) {
  const purchaseDate = String(formData.get("purchaseDate") ?? "");
  const itemName = String(formData.get("itemName") ?? "").trim();
  const category = String(formData.get("category") ?? "bahan_baku") as rawMaterialService.PurchaseCategory;
  const quantityRaw = formData.get("quantity");
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const unitPriceRaw = formData.get("unitPrice");
  const amount = Number(formData.get("amount") ?? 0);
  const supplier = String(formData.get("supplier") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await rawMaterialService.createPurchase({
    purchaseDate,
    itemName,
    category,
    quantity: quantityRaw ? Number(quantityRaw) : null,
    unit,
    unitPrice: unitPriceRaw ? Number(unitPriceRaw) : null,
    amount,
    supplier,
    notes,
  });
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/reports");
}

export async function deletePurchaseAction(id: string) {
  await rawMaterialService.deletePurchase(id);
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/reports");
}

/** Admin/Owner menandai catatan belanja (biasanya dari Captain) sebagai
 * "sudah diketahui" — ditegakkan RLS raw_material_purchases_manage
 * (SUPER_ADMIN/OWNER saja), Captain yang memanggil ini akan gagal. */
export async function acknowledgePurchaseAction(id: string) {
  await rawMaterialService.acknowledgePurchase(id);
  revalidatePath("/admin/purchases");
}

export async function listPurchasesAction(startDate: string, endDate: string) {
  return rawMaterialService.listPurchases(startDate, endDate);
}

export async function createAssetAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "equipment") as depreciationService.AssetCategory;
  const acquisitionDate = String(formData.get("acquisitionDate") ?? "");
  const acquisitionCost = Number(formData.get("acquisitionCost") ?? 0);
  const residualValue = Number(formData.get("residualValue") ?? 0);
  const usefulLifeMonths = Number(formData.get("usefulLifeMonths") ?? 0);
  const expenseType = String(formData.get("expenseType") ?? "operational") as depreciationService.AssetExpenseType;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await depreciationService.createAsset({
    name,
    category,
    acquisitionDate,
    acquisitionCost,
    residualValue,
    usefulLifeMonths,
    expenseType,
    notes,
  });
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/reports");
}

export async function toggleAssetActiveAction(id: string, isActive: boolean) {
  await depreciationService.toggleAssetActive(id, isActive);
  revalidatePath("/admin/purchases");
  revalidatePath("/admin/reports");
}
