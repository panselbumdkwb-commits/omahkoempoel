"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Notifikasi status pesanan (toast + suara), dipakai bareng di 3 papan:
 * Kasir (/pos), Dapur (/kitchen), dan Bar (/bar). Setiap papan cukup
 * kirim daftar order yang sedang ia lihat (id + status + order_number +
 * label meja), komponen ini yang membandingkan dengan snapshot
 * sebelumnya dan memicu notifikasi untuk 4 transisi:
 *   - NEW / CONFIRMED  -> "Pesanan baru masuk"
 *   - PROCESSING       -> "Pesanan sedang diproses"
 *   - READY            -> "Pesanan siap diantar"
 *   - SERVED           -> "Pesanan selesai disajikan"
 *
 * Suara dibuat lewat WebAudio (beep sintetis) supaya tidak butuh file
 * audio eksternal. Beberapa browser memblokir audio sebelum ada
 * interaksi pengguna — begitu staf klik apa pun di halaman (login,
 * tombol, dll), AudioContext akan otomatis "resume" lewat listener di
 * bawah, jadi notifikasi berikutnya tetap berbunyi.
 */

export type NotifiableOrder = {
  id: string;
  status: string;
  order_number: string;
  label?: string | null; // mis. "Meja A1" / "Take Away", opsional untuk teks toast
};

type ToastKind = "masuk" | "proses" | "siap" | "selesai";

type Toast = {
  id: string;
  kind: ToastKind;
  text: string;
};

const WATCHED: Record<string, ToastKind> = {
  NEW: "masuk",
  CONFIRMED: "masuk",
  PROCESSING: "proses",
  READY: "siap",
  SERVED: "selesai",
};

const KIND_META: Record<ToastKind, { icon: string; label: string; className: string; freq: number }> = {
  masuk: { icon: "🆕", label: "Pesanan baru masuk", className: "bg-primary text-white", freq: 880 },
  proses: { icon: "👨‍🍳", label: "Pesanan sedang diproses", className: "bg-warning text-white", freq: 660 },
  siap: { icon: "✅", label: "Pesanan siap diantar", className: "bg-success text-white", freq: 990 },
  selesai: { icon: "🎉", label: "Pesanan selesai disajikan", className: "bg-secondary text-white", freq: 523 },
};

let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioCtx) sharedAudioCtx = new Ctor();
  return sharedAudioCtx;
}

function playBeep(freq: number) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    // Beep kedua untuk kesan "ding-dong" ringan, khusus siap/selesai
    // supaya lebih terasa berbeda dari sekadar order masuk.
  } catch {
    // Audio bisa gagal di browser tertentu (autoplay policy dsb) — abaikan,
    // toast visual tetap tampil jadi notifikasi tidak sepenuhnya hilang.
  }
}

/** Sekali dipanggil di root layout papan (Kasir/Dapur/Bar) supaya
 * AudioContext ke-"resume" begitu staf melakukan interaksi pertama
 * (klik/tap di mana saja), menghindari notifikasi bisu karena
 * kebijakan autoplay browser. */
function useUnlockAudioOnFirstInteraction() {
  useEffect(() => {
    function unlock() {
      const ctx = getAudioCtx();
      if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
}

export default function OrderNotifications({
  orders,
  soundEnabled = true,
}: {
  orders: NotifiableOrder[];
  soundEnabled?: boolean;
}) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prevStatusRef = useRef<Map<string, string> | null>(null);
  useUnlockAudioOnFirstInteraction();

  useEffect(() => {
    const prev = prevStatusRef.current;

    // Pertama kali render: cuma rekam snapshot awal, jangan munculkan
    // notifikasi untuk order yang memang sudah ada sejak halaman dibuka.
    if (prev === null) {
      prevStatusRef.current = new Map(orders.map((o) => [o.id, o.status]));
      return;
    }

    const next = new Map(orders.map((o) => [o.id, o.status]));
    const fresh: Toast[] = [];

    for (const order of orders) {
      const prevStatus = prev.get(order.id);
      const kind = WATCHED[order.status];
      if (!kind) continue;

      const isNewOrder = prevStatus === undefined;
      const statusChanged = prevStatus !== undefined && prevStatus !== order.status;

      // Untuk kind "masuk": trigger kalau order baru muncul di daftar.
      // Untuk kind lain: trigger kalau status barusan berubah ke situ.
      const shouldNotify = kind === "masuk" ? isNewOrder : statusChanged;
      if (!shouldNotify) continue;

      const meta = KIND_META[kind];
      const suffix = order.label ? ` · ${order.label}` : "";
      fresh.push({
        id: `${order.id}-${order.status}-${Date.now()}`,
        kind,
        text: `${meta.label}: ${order.order_number}${suffix}`,
      });
    }

    if (fresh.length > 0) {
      setToasts((cur) => [...cur, ...fresh]);
      if (soundEnabled) {
        // Mainkan beep unik per jenis notifikasi, sedikit dijeda kalau
        // ada beberapa event sekaligus supaya tidak jadi satu bunyi kacau.
        fresh.forEach((t, idx) => {
          setTimeout(() => playBeep(KIND_META[t.kind].freq), idx * 180);
        });
      }
      // Auto-dismiss tiap toast setelah 6 detik.
      fresh.forEach((t) => {
        setTimeout(() => {
          setToasts((cur) => cur.filter((x) => x.id !== t.id));
        }, 6000);
      });
    }

    prevStatusRef.current = next;
  }, [orders, soundEnabled]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-3 right-3 z-[100] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      {toasts.map((t) => {
        const meta = KIND_META[t.kind];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md shadow-lg px-4 py-3 text-sm font-semibold flex items-center gap-2 animate-[fadeIn_0.2s_ease-out] ${meta.className}`}
          >
            <span className="text-lg leading-none">{meta.icon}</span>
            <span>{t.text}</span>
          </div>
        );
      })}
    </div>
  );
}
