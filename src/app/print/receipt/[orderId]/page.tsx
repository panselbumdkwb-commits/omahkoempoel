import * as orderService from "@/services/orderService";
import PrintButton from "../../PrintButton";

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export default async function ReceiptPage({ params }: { params: { orderId: string } }) {
  const { order, items } = await orderService.getOrderDetail(params.orderId);
  const table = Array.isArray(order.tables) ? order.tables[0] : order.tables;

  return (
    <>
      <div className="w-[72mm] mx-auto p-2 font-mono text-xs leading-tight">
        <h1 className="text-center font-bold text-sm">OMAH KOEMPOEL</h1>
        <p className="text-center text-[10px] mb-3">Ngumpul · Ngopi · Nikmati</p>
        <hr className="border-black mb-2" />
        <p>No. Transaksi: {order.order_number}</p>
        <p>Tanggal: {new Date().toLocaleString("id-ID")}</p>
        <p>{order.order_type === "take_away" ? "Take Away" : `Meja ${table?.number ?? "-"}`}</p>
        {order.customer_name && <p>Pelanggan: {order.customer_name}</p>}
        <hr className="border-black my-2" />
        {items.map((item: any) => (
          <div key={item.id} className="flex justify-between gap-2 mb-1">
            <span className="break-words">
              {item.quantity}x {item.products?.name}
              {item.order_item_modifiers?.length > 0 && (
                <span className="block text-[10px] pl-3">
                  {item.order_item_modifiers.map((m: any) => m.name).join(", ")}
                </span>
              )}
            </span>
            <span className="shrink-0">{formatRupiah(item.quantity * Number(item.unit_price))}</span>
          </div>
        ))}
        <hr className="border-black my-2" />
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatRupiah(Number(order.subtotal))}</span>
        </div>
        <div className="flex justify-between">
          <span>Diskon</span>
          <span>Rp 0</span>
        </div>
        <div className="flex justify-between">
          <span>Pajak</span>
          <span>Rp 0*</span>
        </div>
        <div className="flex justify-between">
          <span>Service Charge</span>
          <span>Rp 0</span>
        </div>
        <hr className="border-black my-2" />
        <div className="flex justify-between font-bold text-sm">
          <span>TOTAL</span>
          <span>{formatRupiah(Number(order.grand_total))}</span>
        </div>
        <p className="text-center text-[10px] mt-4">*Pajak belum dikonfigurasi di sistem.</p>
        <p className="text-center text-[10px] mt-4">Terima kasih atas kunjungan Anda 🙏</p>
      </div>
      <PrintButton />
    </>
  );
}
