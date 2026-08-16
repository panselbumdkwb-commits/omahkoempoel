import * as kitchenService from "@/services/kitchenService";
import KitchenBoard from "./KitchenBoard";

export default async function KitchenPage() {
  const orders = await kitchenService.listKitchenBoard();
  return <KitchenBoard initialOrders={orders} />;
}
