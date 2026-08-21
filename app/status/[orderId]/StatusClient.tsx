"use client";

import { useEffect, useRef, useState } from "react";
import { getPublicOrderStatusAction } from "../../actions";
import DateTimeBadge from "@/components/DateTimeBadge";

type OrderStatus = {
  order_number: string;
  status: string;
  grand_total: number;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  NEW: "Pesanan diterima, menunggu diproses kasir",
  CONFIRMED: "Pesanan dikonfirmasi, dikirim ke dapur",
  PROCESSING: "Sedang disiapkan dapur",
  READY: "Siap disajikan",
  SERVED: "Sudah disajikan",
  PAID: "Pembayaran diterima ✅",
  CLOSED: "Selesai",
};

// Status yang menandakan pembayaran sudah beres — begitu status masuk
// salah satu dari ini, polling dihentikan dan notifikasi ditampilkan.
const TERMINAL_STATUSES = ["PAID", "CLOSED"];

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export default function StatusClient({
  orderId,
  showDateTimeClock,
}: {
  orderId: string;
  showDateTimeClock: boolean;
}) {
  const [data, setData] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);
  const previousStatus = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const result = await getPublicOrderStatusAction(orderId);
        if (cancelled) return;
        setError(null);

        // Transisi BARU menuju status lunas -> tandai untuk notifikasi
        // & getarkan perangkat (kalau didukung browser pembeli).
        if (
          previousStatus.current &&
          !TERMINAL_STATUSES.includes(previousStatus.current) &&
          TERMINAL_STATUSES.includes(result.status)
        ) {
          setJustPaid(true);
          if (typeof navigator !== "undefined" && "vibrate" in navigator) {
            navigator.vibrate([200, 100, 200]);
          }
        }
        previousStatus.current = result.status;
        setData(result as OrderStatus);

        // Hentikan polling begitu sudah di status akhir — hemat request,
        // pembeli tetap melihat status terakhir di layar.
        if (!TERMINAL_STATUSES.includes(result.status)) {
          timer = setTimeout(poll, 4000);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message ?? "Gagal memuat status pesanan.");
        timer = setTimeout(poll, 6000);
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  return (
    <main className="min-h-screen bg-wood-grain flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-parchment rounded-2xl p-8 text-center shadow-xl">
        {showDateTimeClock && (
          <DateTimeBadge variant="full" className="block font-jakarta text-xs text-wood-mid mb-4" />
        )}
        {!data && !error && (
          <p className="font-jakarta text-wood-mid">Memuat status pesanan...</p>
        )}

        {error && !data && (
          <>
            <div className="text-4xl mb-3">⚠️</div>
            <p className="font-jakarta text-wood-mid">{error}</p>
          </>
        )}

        {data && (
          <>
            <div className="text-4xl mb-3">{justPaid ? "✅" : "🧾"}</div>
            <h1 className="font-ukir text-2xl text-wood-dark mb-1">{data.order_number}</h1>
            <p className="font-jakarta text-wood-mid mb-4">
              Total: <span className="font-bold text-sogan">{formatRupiah(data.grand_total)}</span>
            </p>

            <div
              className={`rounded-lg p-4 mb-2 font-jakarta font-semibold ${
                TERMINAL_STATUSES.includes(data.status)
                  ? "bg-daun/20 text-daun"
                  : "bg-batik-gold/20 text-wood-dark"
              }`}
            >
              {STATUS_LABEL[data.status] ?? data.status}
            </div>

            {!TERMINAL_STATUSES.includes(data.status) && (
              <p className="font-jakarta text-xs text-wood-mid mt-3">
                Halaman ini otomatis memperbarui diri — silakan tetap dibuka sambil menunggu.
              </p>
            )}

            {TERMINAL_STATUSES.includes(data.status) && (
              <p className="font-jakarta text-xs text-wood-mid mt-3">
                Terima kasih! Sampai jumpa lagi di Omah Koempoel.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
