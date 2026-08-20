import * as catalogService from "@/services/catalogService";
import { requireAdminOrOwner } from "@/lib/auth";
import MenuManagerClient from "./MenuManagerClient";

export default async function AdminMenuPage() {
  await requireAdminOrOwner();
  const { categories, products } = await catalogService.listCatalog();

  return <MenuManagerClient categories={categories} products={products} />;
}
