"use client";

import { useEffect, useState, useTransition } from "react";
import { kioskClockAction, getTodayScheduleAction } from "./actions";
import DateTimeBadge from "@/components/DateTimeBadge";

type Employee = { id: string; full_name: string | null; employee_code: string };
type TodaySchedule = { shift_start: string | null; shift_end: string | null; is_off: boolean } | null;

export default function KioskClient({
  employees,
  showDateTimeClock,
}: {
  employees: Employee[];
  showDateTimeClock: boolean;
}) {
  const [selected, setSelected] = useState<Employee | null>(null);
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [todaySchedule, setTodaySchedule] = useState<TodaySchedule>(null);

  useEffect(() => {
    if (!selected) {
      setTodaySchedule(null);
      return;
    }
    getTodayScheduleAction(selected.id).then(setTodaySchedule);
  }, [selected]);

  function reset() {
    setSelected(null);
    setPin("");
  }

  function pressDigit(d: string) {
    if (pin.length >= 6) return;
    setPin(pin + d);
  }

  function submit(action: "in" | "out") {
    if (!selected || pin.length < 4) return;
    startTransition(async () => {
      try {
        const res = await kioskClockAction(selected.id, pin, action);
        setResult({ ok: true, message: res.message });
      } catch (err: any) {
        setResult({ ok: false, message: err.message });
      }
      setPin("");
      setTimeout(() => {
        setResult(null);
        reset();
      }, 2500);
    });
  }

  if (result) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background dark:bg-background-dark p-8">
        <div
          className={`max-w-md w-full text-center rounded-2xl p-10 border-2 ${
            result.ok ? "border-success bg-success/10" : "border-danger bg-danger/10"
          }`}
        >
          <div className="text-5xl mb-4">{result.ok ? "✅" : "⚠️"}</div>
          <p className="text-xl font-semibold">{result.message}</p>
        </div>
      </main>
    );
  }

  if (!selected) {
    return (
      <main className="min-h-screen bg-background dark:bg-background-dark p-6">
        <h1 className="font-heading text-3xl text-primary text-center mb-2">
          Absensi Pegawai — Omah Koempoel
        </h1>
        {showDateTimeClock && (
          <p className="text-center mb-6">
            <DateTimeBadge variant="full" className="text-primary font-semibold" />
          </p>
        )}
        <p className="text-center text-text-muted mb-6">Pilih nama Anda untuk melanjutkan</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
          {employees.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelected(e)}
              className="bg-surface dark:bg-surface-dark border border-border rounded-xl p-6 text-lg font-semibold active:scale-95 transition-transform"
            >
              {e.full_name}
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background dark:bg-background-dark p-6 flex flex-col items-center">
      <h1 className="font-heading text-2xl text-primary mb-1">{selected.full_name}</h1>
      {showDateTimeClock && (
        <DateTimeBadge variant="full" className="text-sm text-text-muted mb-2" />
      )}
      {todaySchedule && (
        <p className="text-xs text-text-muted mb-2">
          {todaySchedule.is_off
            ? "Jadwal hari ini: Libur"
            : todaySchedule.shift_start && todaySchedule.shift_end
              ? `Jadwal hari ini: ${todaySchedule.shift_start.slice(0, 5)} – ${todaySchedule.shift_end.slice(0, 5)} WIB`
              : "Jadwal hari ini belum diatur"}
        </p>
      )}
      <button onClick={reset} className="text-sm text-text-muted mb-6">
        ← Bukan Anda? Ganti pegawai
      </button>

      <div className="flex gap-3 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xl ${
              i < pin.length ? "border-primary bg-primary text-white" : "border-border"
            }`}
          >
            {i < pin.length ? "•" : ""}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-xs mb-6">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => pressDigit(d)}
            className="w-20 h-20 rounded-full bg-surface dark:bg-surface-dark border border-border text-2xl font-semibold active:scale-95"
          >
            {d}
          </button>
        ))}
        <button
          onClick={() => setPin("")}
          className="w-20 h-20 rounded-full border border-border text-sm font-semibold active:scale-95"
        >
          Hapus
        </button>
        <button
          onClick={() => pressDigit("0")}
          className="w-20 h-20 rounded-full bg-surface dark:bg-surface-dark border border-border text-2xl font-semibold active:scale-95"
        >
          0
        </button>
        <button
          onClick={() => setPin(pin.slice(0, -1))}
          className="w-20 h-20 rounded-full border border-border text-sm font-semibold active:scale-95"
        >
          ⌫
        </button>
      </div>

      <div className="flex gap-4 w-full max-w-xs">
        <button
          onClick={() => submit("in")}
          disabled={pin.length < 4 || isPending}
          className="flex-1 bg-success text-white py-4 rounded-xl font-bold disabled:opacity-40"
        >
          Absen Masuk
        </button>
        <button
          onClick={() => submit("out")}
          disabled={pin.length < 4 || isPending}
          className="flex-1 bg-sogan text-white py-4 rounded-xl font-bold disabled:opacity-40"
        >
          Absen Pulang
        </button>
      </div>
    </main>
  );
}
