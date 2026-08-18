import * as barService from "@/services/barService";
import { getShowDateTimeClock } from "@/services/settingsService";
import BarBoard from "./BarBoard";

export default async function BarPage() {
  const [orders, showDateTimeClock] = await Promise.all([
    barService.listBarBoard(),
    getShowDateTimeClock(),
  ]);
  return <BarBoard initialOrders={orders} showDateTimeClock={showDateTimeClock} />;
}
