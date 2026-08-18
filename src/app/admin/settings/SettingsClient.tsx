"use client";

import { useState, useTransition } from "react";
import {
  setShowDateTimeClockAction,
  setCafeOperatingHoursAction,
  setEmployeeWorkHoursAction,
} from "./actions";
import DateTimeBadge from "@/components/DateTimeBadge";

export default function SettingsClient({
  role,
  initialShowDateTimeClock,
  initialCafeOperatingHours,
  initialEmployeeWorkHours,
}: {
  role: string | null;
  initialShowDateTimeClock: boolean;
  initialCafeOperatingHours: string;
  initialEmployeeWorkHours: string;
}) {
  const [showClock, setShowClock] = useState(initialShowDateTimeClock);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canEdit = role === "SUPER_ADMIN";

  const [cafeHours, setCafeHours] = useState(initialCafeOperatingHours);
  const [cafeHoursSaved, setCafeHoursSaved] = useState(initialCafeOperatingHours);
  const [cafeHoursStatus, setCafeHoursStatus] = useState<string | null>(null);

  const [workHours, setWorkHours] = useState(initialEmployeeWorkHours);
  const [workHoursSaved, setWorkHoursSaved] = useState(initialEmployeeWorkHours);
  const [workHoursStatus, setWorkHoursStatus] = useState<string | null>(null);

  function toggleClock() {
    const next = !showClock;
    setShowClock(next); // optimistik — UI langsung berubah
    setError(null);
    startTransition(async () => {
      try {
        await setShowDateTimeClockAction(next);
      } catch (err: any) {
        setShowClock(!next); // gagal simpan -> kembalikan ke nilai semula
        setError(err.message ?? "Gagal menyimpan pengaturan.");
      }
    });
  }

  function saveCafeHours() {
    setCafeHoursStatus(null);
    startTransition(async () => {
      try {
        await setCafeOperatingHoursAction(cafeHours);
        setCafeHoursSaved(cafeHours);
        setCafeHoursStatus("Tersimpan.");
      } catch (err: any) {
        setCafeHoursStatus(err.message ?? "Gagal menyimpan.");
      }
    });
  }

  function saveWorkHours() {
    setWorkHoursStatus(null);
    startTransition(async () => {
      try {
        await setEmployeeWorkHoursAction(workHours);
        setWorkHoursSaved(workHours);
        setWorkHoursStatus("Tersimpan.");
      } catch (err: any) {
        setWorkHoursStatus(err.message ?? "Gagal menyimpan.");
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="font-heading text-2xl text-primary">Pengaturan</h2>

      {/* Jam Hari/Tanggal/Waktu */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold mb-1">Tampilkan Hari, Tanggal & Waktu (WIB)</p>
            <p className="text-sm text-text-muted">
              Jika aktif, jam berjalan (Hari, Tanggal, Waktu — zona WIB) akan tampil di bagian atas
              semua halaman: menu pembeli, kasir, dapur, admin, dan kiosk absensi.
            </p>
            {!canEdit && (
              <p className="text-xs text-text-muted mt-2">
                Hanya akun Super Admin yang dapat mengubah pengaturan ini.
              </p>
            )}
          </div>
          <button
            onClick={toggleClock}
            disabled={!canEdit || isPending}
            aria-pressed={showClock}
            className={`shrink-0 w-14 h-8 rounded-full transition-colors relative disabled:opacity-50 ${
              showClock ? "bg-success" : "bg-border"
            }`}
          >
            <span
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                showClock ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {error && <p className="text-sm text-danger mt-3">{error}</p>}

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-text-muted mb-2">Pratinjau tampilan:</p>
          <div className="bg-background dark:bg-background-dark rounded-md p-3 text-sm font-jakarta text-text">
            {showClock ? (
              <DateTimeBadge variant="full" />
            ) : (
              <span className="text-text-muted italic">Widget disembunyikan</span>
            )}
          </div>
        </div>
      </section>

      {/* Jam Buka Cafe */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <p className="font-semibold mb-1">Jam Buka Cafe</p>
        <p className="text-sm text-text-muted mb-3">
          Ditampilkan di halaman menu pembeli, di bawah jam berjalan. Bebas format teks, mis. "08:00 –
          22:00 WIB" atau "Setiap hari, 08.00–22.00".
        </p>
        <div className="flex gap-2">
          <input
            value={cafeHours}
            onChange={(e) => setCafeHours(e.target.value)}
            disabled={!canEdit}
            className="flex-1 border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
          />
          <button
            onClick={saveCafeHours}
            disabled={!canEdit || isPending || cafeHours === cafeHoursSaved}
            className="px-4 rounded-md bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            Simpan
          </button>
        </div>
        {cafeHoursStatus && <p className="text-sm text-text-muted mt-2">{cafeHoursStatus}</p>}
        {!canEdit && (
          <p className="text-xs text-text-muted mt-2">Hanya Super Admin yang dapat mengubah ini.</p>
        )}
      </section>

      {/* Jam Kerja Pegawai (kebijakan umum) */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <p className="font-semibold mb-1">Jam Kerja Pegawai</p>
        <p className="text-sm text-text-muted mb-3">
          Kebijakan shift umum (teks bebas) — ditampilkan di halaman Admin dan kiosk absensi sebagai
          panduan. Untuk jadwal harian per pegawai, gunakan menu{" "}
          <span className="font-semibold">Jadwal Kerja</span>.
        </p>
        <div className="flex gap-2">
          <input
            value={workHours}
            onChange={(e) => setWorkHours(e.target.value)}
            disabled={!canEdit}
            className="flex-1 border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
          />
          <button
            onClick={saveWorkHours}
            disabled={!canEdit || isPending || workHours === workHoursSaved}
            className="px-4 rounded-md bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            Simpan
          </button>
        </div>
        {workHoursStatus && <p className="text-sm text-text-muted mt-2">{workHoursStatus}</p>}
        {!canEdit && (
          <p className="text-xs text-text-muted mt-2">Hanya Super Admin yang dapat mengubah ini.</p>
        )}
      </section>
    </div>
  );
}
