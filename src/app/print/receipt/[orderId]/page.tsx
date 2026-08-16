import * as orderService from "@/services/orderService";
import AutoPrint from "../../AutoPrint";

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export default async function ReceiptPage({ params }: { params: { orderId: string } }) {
  const { order, items } = await orderService.getOrderDetail(params.orderId);
  const table = Array.isArray(order.tables) ? order.tables[0] : order.tables;

  return (
    <AutoPrint>
      <div className="max-w-sm mx-auto p-6 font-mono text-sm">
        <h1 className="text-center font-bold text-lg">OMAH KOEMPOEL</h1>
        <p className="text-center text-xs mb-4">Ngumpul · Ngopi · Nikmati</p>
        <hr className="border-black mb-2" />
        <p>No. Transaksi: {order.order_number}</p>
        <p>Tanggal: {new Date().toLocaleString("id-ID")}</p>
        <p>{order.order_type === "take_away" ? "Take Away" : `Meja ${table?.number ?? "-"}`}</p>
        {order.customer_name && <p>Pelanggan: {order.customer_name}</p>}
        <hr className="border-black my-2" />
        {items.map((item: any) => (
          <div key={item.id} className="flex justify-between mb-1">
            <span>
              {item.quantity}x {item.products?.name}
              {item.order_item_modifiers?.length > 0 && (
                <span className="block text-xs pl-3">
                  {item.order_item_modifiers.map((m: any) => m.name).join(", ")}
                </span>
              )}
            </span>
            <span>{formatRupiah(item.quantity * Number(item.unit_price))}</span>
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
        <div className="flex justify-between font-bold text-base">
          <span>TOTAL</span>
          <span>{formatRupiah(Number(order.grand_total))}</span>
        </div>
        <p className="text-center text-xs mt-4">*Pajak belum dikonfigurasi di sistem.</p>
        <p className="text-center mt-4">Terima kasih atas kunjungan Anda 🙏</p>
      </div>
    </AutoPrint>
  );
}
