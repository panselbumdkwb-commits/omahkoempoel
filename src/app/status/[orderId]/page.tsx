import { getShowDateTimeClock } from "@/services/settingsService";
import StatusClient from "./StatusClient";

export default async function OrderStatusPage({ params }: { params: { orderId: string } }) {
  const showDateTimeClock = await getShowDateTimeClock();
  return <StatusClient orderId={params.orderId} showDateTimeClock={showDateTimeClock} />;
}
