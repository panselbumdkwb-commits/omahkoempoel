"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getPettyCashSummaryAction,
  getPettyCashDefaultAmountAction,
  openPettyCashDayAction,
  recordPettyCashUsageAction,
  closePettyCashDayAction,
} from "./petty-cash-actions";

type PettyCashDay = {
  id: string;
  cash_date: string;
  opening_amount: number;
  opening_notes: string | null;
  status: "open" | "closed";
  closing_amount: number | null;
};
type PettyCashEntry = { id: string; description: string; amount: number; created_at: string };
type Summary = { day: PettyCashDay | null; entries: PettyCashEntry[]; totalUsed: number; balance: number };

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

/**
 * Fasilitas Kas Kecil Harian di akun Kasir. Nominal awal ditentukan
 * SUPER_ADMIN/OWNER lewat tombol "Buka Kas Kecil" (RLS DB memastikan
 * ini walau tombolnya juga disembunyikan di UI untuk role lain).
 * Kasir/Captain hanya bisa melihat saldo & mencatat pemakaian.
 */
export default function PettyCashWidget({ role }: { role?: string | null }) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canOpenDay = role === "SUPER_ADMIN" || role === "OWNER";

  const [openingAmount, setOpeningAmount] = useState("");
  const [usageDesc, setUsageDesc] = useState("");
  const [usageAmount, setUsageAmount] = useState("");

  function refresh() {
    setLoading(true);
    getPettyCashSummaryAction()
      .then(setSummary)
      .catch((err: any) => setMessage(`Gagal memuat Kas Kecil: ${err.message}`))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    refresh();
    // Prefill nominal saran default kalau Owner/Admin belum buka hari ini.
    if (canOpenDay) {
      getPettyCashDefaultAmountAction()
        .then((n) => setOpeningAmount(n > 0 ? String(n) : ""))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleOpenDay() {
    setMessage(null);
    const amount = Number(openingAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage("Nominal awal tidak valid.");
      return;
    }
    startTransition(async () => {
      try {
        await openPettyCashDayAction(amount);
        refresh();
      } catch (err: any) {
        setMessage(err.message ?? "Gagal membuka Kas Kecil.");
      }
    });
  }

  function handleRecordUsage() {
    setMessage(null);
    if (!summary?.day) return;
    const amount = Number(usageAmount);
    if (!usageDesc.trim() || !Number.isFinite(amount) || amount <= 0) {
      setMessage("Isi keterangan & nominal pemakaian dengan benar.");
      return;
    }
    startTransition(async () => {
      try {
        await recordPettyCashUsageAction(summary.day!.id, usageDesc, amount);
        setUsageDesc("");
        setUsageAmount("");
        refresh();
      } catch (err: any) {
        setMessage(err.message ?? "Gagal mencatat pemakaian.");
      }
    });
  }

  function handleCloseDay() {
    if (!summary?.day) return;
    startTransition(async () => {
      try {
        await closePettyCashDayAction(summary.day!.id, summary.balance);
        refresh();
      } catch (err: any) {
        setMessage(err.message ?? "Gagal menutup Kas Kecil.");
      }
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="pill-nav-link bg-secondary/15 text-secondary dark:text-secondary-dark font-bold hover:bg-secondary/25 text-sm flex items-center gap-1.5"
        title="Kas Kecil Harian"
      >
        💵 Kas Kecil
        {summary?.day && (
          <span className="font-mono">{formatRupiah(summary.balance)}</span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 z-50 card-modern p-4 shadow-xl text-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-heading text-base text-primary">Kas Kecil Harian</h3>
            <button onClick={() => setOpen(false)} className="text-text-muted text-xs">
              Tutup
            </button>
          </div>

          {loading && <p className="text-xs text-text-muted">Memuat…</p>}

          {message && (
            <div className="rounded-md bg-surface dark:bg-surface-dark border border-border p-2 text-xs mb-2">
              {message}
            </div>
          )}

          {!loading && !summary?.day && (
            <div>
              <p className="text-xs text-text-muted mb-3">
                Kas Kecil hari ini belum dibuka
                {canOpenDay ? "." : " oleh Owner/Admin. Hubungi Owner/Admin untuk membukanya."}
              </p>
              {canOpenDay && (
                <div className="space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-text-muted">Rp</span>
                    <input
                      type="number"
                      min={0}
                      step="1000"
                      value={openingAmount}
                      onChange={(e) => setOpeningAmount(e.target.value)}
                      placeholder="Nominal awal"
                      className="flex-1 border border-border rounded-md p-1.5 bg-background dark:bg-background-dark text-sm"
                    />
                  </div>
                  <button
                    onClick={handleOpenDay}
                    disabled={isPending}
                    className="w-full bg-primary text-white py-1.5 rounded-md font-semibold text-sm disabled:opacity-50"
                  >
                    Buka Kas Kecil Hari Ini
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && summary?.day && (
            <div>
              <div className="rounded-md border border-border p-2 mb-3 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-text-muted">Nominal Awal</span>
                  <span>{formatRupiah(summary.day.opening_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Terpakai</span>
                  <span>{formatRupiah(summary.totalUsed)}</span>
                </div>
                <div className="flex justify-between font-bold text-primary border-t border-border pt-0.5 mt-0.5">
                  <span>Saldo</span>
                  <span>{formatRupiah(summary.balance)}</span>
                </div>
                {summary.day.status === "closed" && (
                  <p className="text-xs text-warning pt-1">Sudah ditutup untuk hari ini.</p>
                )}
              </div>

              {summary.day.status === "open" && (
                <div className="space-y-2 mb-3">
                  <input
                    value={usageDesc}
                    onChange={(e) => setUsageDesc(e.target.value)}
                    placeholder="Keterangan (mis. beli es batu)"
                    className="w-full border border-border rounded-md p-1.5 bg-background dark:bg-background-dark text-sm"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      step="500"
                      value={usageAmount}
                      onChange={(e) => setUsageAmount(e.target.value)}
                      placeholder="Nominal"
                      className="flex-1 border border-border rounded-md p-1.5 bg-background dark:bg-background-dark text-sm"
                    />
                    <button
                      onClick={handleRecordUsage}
                      disabled={isPending}
                      className="px-3 rounded-md bg-secondary text-white text-sm font-semibold disabled:opacity-50"
                    >
                      Catat
                    </button>
                  </div>
                  {canOpenDay && (
                    <button
                      onClick={handleCloseDay}
                      disabled={isPending}
                      className="w-full border border-border py-1.5 rounded-md text-xs font-semibold disabled:opacity-50"
                    >
                      Tutup Kas Kecil Hari Ini (rekonsiliasi)
                    </button>
                  )}
                </div>
              )}

              {summary.entries.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-text-muted mb-1">Riwayat Pemakaian</p>
                  <div className="max-h-40 overflow-y-auto divide-y divide-border">
                    {summary.entries.map((e) => (
                      <div key={e.id} className="flex justify-between py-1 text-xs">
                        <span>{e.description}</span>
                        <span>{formatRupiah(e.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
