import * as orderService from "@/services/orderService";
import PrintButton from "../../PrintButton";
import { formatJakartaDateTime } from "@/lib/timezone";

export default async function KitchenTicketPage({ params }: { params: { orderId: string } }) {
  const { order, items } = await orderService.getOrderDetail(params.orderId);
  const table = Array.isArray(order.tables) ? order.tables[0] : order.tables;

  return (
    <>
      <div className="w-[72mm] mx-auto p-2 font-mono text-xs leading-tight">
        <h1 className="text-center font-bold text-sm mb-1">TIKET DAPUR</h1>
        <p className="text-center text-[10px] mb-3">Omah Mburi</p>
        <hr className="border-black mb-2" />
        <p>No. Order: {order.order_number}</p>
        <p>{order.order_type === "take_away" ? "Take Away" : `Meja ${table?.number ?? "-"}`}</p>
        {order.customer_name && <p>Pelanggan: {order.customer_name}</p>}
        <hr className="border-black my-2" />
        {items.map((item: any) => (
          <div key={item.id} className="mb-2 break-words">
            <p className="font-bold">
              {item.quantity}x {item.products?.name}
            </p>
            {item.order_item_modifiers?.length > 0 && (
              <p className="text-[10px] pl-3">{item.order_item_modifiers.map((m: any) => m.name).join(", ")}</p>
            )}
            {item.notes && <p className="text-[10px] pl-3">Catatan: {item.notes}</p>}
          </div>
        ))}
        <hr className="border-black my-2" />
        <p className="text-center text-[10px]">{formatJakartaDateTime(new Date())}</p>
      </div>
      <PrintButton />
    </>
  );
}
