import StatusClient from "./StatusClient";

export default function OrderStatusPage({ params }: { params: { orderId: string } }) {
  return <StatusClient orderId={params.orderId} />;
}
