"use server";

import { revalidatePath } from "next/cache";
import * as inventoryService from "@/services/inventoryService";
import type { InventoryCategory } from "@/services/inventoryService";

export async function listInventoryItemsAction() {
  return inventoryService.listInventoryItems();
}

export async function createInventoryItemAction(formData: FormData) {
  const category = String(formData.get("category") ?? "bahan_baku") as InventoryCategory;
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "pcs").trim();
  const parStock = Number(formData.get("parStock") ?? 0);
  const alertThresholdPercent = Number(formData.get("alertThresholdPercent") ?? 10);
  const initialStock = Number(formData.get("initialStock") ?? 0);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await inventoryService.createInventoryItem({
    category,
    name,
    unit,
    parStock,
    alertThresholdPercent,
    initialStock,
    notes,
  });
  revalidatePath("/admin/inventory");
}

export async function recordStockMovementAction(formData: FormData) {
  const inventoryItemId = String(formData.get("inventoryItemId") ?? "");
  const movementType = String(formData.get("movementType") ?? "in") as "in" | "out" | "adjustment";
  const quantity = Number(formData.get("quantity") ?? 0);
  const note = String(formData.get("note") ?? "").trim() || null;

  await inventoryService.recordStockMovement({ inventoryItemId, movementType, quantity, note });
  revalidatePath("/admin/inventory");
}

export async function updateInventoryItemAction(id: string, isActive: boolean) {
  await inventoryService.updateInventoryItem(id, { isActive });
  revalidatePath("/admin/inventory");
}

export async function deleteInventoryItemAction(id: string) {
  await inventoryService.deleteInventoryItem(id);
  revalidatePath("/admin/inventory");
}
