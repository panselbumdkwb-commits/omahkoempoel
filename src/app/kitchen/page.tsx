import * as kitchenService from "@/services/kitchenService";
import { getShowDateTimeClock } from "@/services/settingsService";
import KitchenBoard from "./KitchenBoard";

export default async function KitchenPage() {
  const [orders, showDateTimeClock] = await Promise.all([
    kitchenService.listKitchenBoard(),
    getShowDateTimeClock(),
  ]);
  return <KitchenBoard initialOrders={orders} showDateTimeClock={showDateTimeClock} />;
}
