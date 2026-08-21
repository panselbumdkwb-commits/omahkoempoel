import { requireAdminOrOwner } from "@/lib/auth";
import * as inventoryService from "@/services/inventoryService";
import InventoryClient from "./InventoryClient";

export default async function InventoryPage() {
  // SUPER_ADMIN, OWNER, dan CAPTAIN semua boleh mengelola persediaan —
  // Captain sehari-hari yang paling sering mencatat stok masuk/keluar.
  await requireAdminOrOwner();
  const items = await inventoryService.listInventoryItems();
  return <InventoryClient initialItems={items} />;
}
