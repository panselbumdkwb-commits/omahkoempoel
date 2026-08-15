import * as catalogService from "@/services/catalogService";
import MenuManagerClient from "./MenuManagerClient";

export default async function AdminMenuPage() {
  const { categories, products } = await catalogService.listCatalog();

  return <MenuManagerClient categories={categories} products={products} />;
}
