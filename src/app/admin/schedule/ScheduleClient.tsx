"use client";

import { useState, useTransition } from "react";
import { upsertScheduleEntryAction, generateAutoScheduleAction } from "./actions";

// Ditampilkan Senin dulu (lebih lazim di jadwal kerja), walau di database
// day_of_week 0 = Minggu (konvensi ISO/JS Date.getDay()).
const DISPLAY_DAYS = [
  { value: 1, label: "Senin" },
  { value: 2, label: "Selasa" },
  { value: 3, label: "Rabu" },
  { value: 4, label: "Kamis" },
  { value: 5, label: "Jumat" },
  { value: 6, label: "Sabtu" },
  { value: 0, label: "Minggu" },
];

// 3 shift baku: 2 shift utama + 1 shift cadangan. Shift 2 berakhir tengah
// malam — disimpan sebagai "00:00" (setara 24:00) supaya tetap valid untuk
// <input type="time"> di browser.
const SHIFT_PRESETS = [
  { id: "shift1", label: "Shift 1 (09:00–17:00)", start: "09:00", end: "17:00" },
  { id: "shift2", label: "Shift 2 (16:00–24:00)", start: "16:00", end: "00:00" },
  { id: "shift3", label: "Shift 3 – Cadangan (13:00–21:00)", start: "13:00", end: "21:00" },
  { id: "shiftmalam", label: "Shift Malam (23:00–07:00) – Sekuriti", start: "23:00", end: "07:00" },
  { id: "custom", label: "Kustom (atur manual)", start: "", end: "" },
] as const;

type ShiftId = (typeof SHIFT_PRESETS)[number]["id"];

type Employee = { id: string; full_name: string; employee_code: string; status: string };
type ScheduleRow = {
  id: string;
  employee_id: string;
  day_of_week: number;
  shift_start: string | null;
  shift_end: string | null;
  is_off: boolean;
  note: string | null;
};

type DayState = { shiftPreset: ShiftId | ""; shiftStart: string; shiftEnd: string; isOff: boolean };

function detectPreset(start: string, end: string): ShiftId {
  const match = SHIFT_PRESETS.find((p) => p.id !== "custom" && p.start === start && p.end === end);
  return match ? match.id : "custom";
}

function buildInitialState(employees: Employee[], schedule: ScheduleRow[]) {
  const state: Record<string, Record<number, DayState>> = {};
  for (const emp of employees) {
    state[emp.id] = {};
    for (const day of DISPLAY_DAYS) {
      const existing = schedule.find((s) => s.employee_id === emp.id && s.day_of_week === day.value);
      const start = existing?.shift_start?.slice(0, 5) ?? "";
      const end = existing?.shift_end?.slice(0, 5) ?? "";
      state[emp.id][day.value] = {
        shiftPreset: existing?.is_off ? "" : start && end ? detectPreset(start, end) : "",
        shiftStart: start,
        shiftEnd: end,
        isOff: existing?.is_off ?? false,
      };
    }
  }
  return state;
}

export default function ScheduleClient({
  employees,
  initialSchedule,
}: {
  employees: Employee[];
  initialSchedule: ScheduleRow[];
}) {
  const [state, setState] = useState(() => buildInitialState(employees, initialSchedule));
  const [isPending, startTransition] = useTransition();
  const [savedStatus, setSavedStatus] = useState<Record<string, string>>({});
  const [autoResult, setAutoResult] = useState<{
    entriesWritten: number;
    warnings: string[];
    summary: { position: string; employeeCount: number; note: string }[];
  } | null>(null);
  const [autoMessage, setAutoMessage] = useState<string | null>(null);

  function runAutoGenerate() {
    const ok = window.confirm(
      "Susun ulang jadwal shift otomatis untuk semua pegawai Kasir/Bar/Kitchen/Waitres/Kapten/Sekuriti berdasarkan jabatan saat ini? Ini akan MENIMPA jadwal mereka yang sudah ada."
    );
    if (!ok) return;
    setAutoMessage(null);
    startTransition(async () => {
      try {
        const result = await generateAutoScheduleAction();
        setAutoResult(result);
        setAutoMessage(`Jadwal otomatis tersusun (${result.entriesWritten} entri). Muat ulang halaman untuk melihat hasilnya di grid.`);
      } catch (err: any) {
        setAutoMessage(`Gagal: ${err.message}`);
      }
    });
  }

  function selectShift(employeeId: string, day: number, value: string) {
    setState((prev) => {
      const current = prev[employeeId][day];
      if (value === "off") {
        return {
          ...prev,
          [employeeId]: { ...prev[employeeId], [day]: { ...current, isOff: true, shiftPreset: "" } },
        };
      }
      const preset = SHIFT_PRESETS.find((p) => p.id === value);
      if (!preset) return prev;
      return {
        ...prev,
        [employeeId]: {
          ...prev[employeeId],
          [day]: {
            shiftPreset: preset.id,
            shiftStart: preset.start,
            shiftEnd: preset.end,
            isOff: false,
          },
        },
      };
    });
  }

  function updateManualTime(employeeId: string, day: number, patch: Partial<DayState>) {
    setState((prev) => ({
      ...prev,
      [employeeId]: { ...prev[employeeId], [day]: { ...prev[employeeId][day], ...patch } },
    }));
  }

  function saveEmployeeRow(employeeId: string) {
    setSavedStatus((s) => ({ ...s, [employeeId]: "" }));
    startTransition(async () => {
      try {
        for (const day of DISPLAY_DAYS) {
          const cell = state[employeeId][day.value];
          const preset = SHIFT_PRESETS.find((p) => p.id === cell.shiftPreset);
          await upsertScheduleEntryAction({
            employeeId,
            dayOfWeek: day.value,
            shiftStart: cell.isOff ? null : cell.shiftStart || null,
            shiftEnd: cell.isOff ? null : cell.shiftEnd || null,
            isOff: cell.isOff,
            note: cell.isOff
              ? undefined
              : preset && preset.id !== "custom"
                ? preset.label.split(" (")[0]
                : "Kustom",
          });
        }
        setSavedStatus((s) => ({ ...s, [employeeId]: "Jadwal tersimpan." }));
      } catch (err: any) {
        setSavedStatus((s) => ({ ...s, [employeeId]: err.message ?? "Gagal menyimpan." }));
      }
    });
  }

  if (employees.length === 0) {
    return (
      <div className="max-w-5xl mx-auto">
        <h2 className="font-heading text-2xl text-primary mb-4">Jadwal Kerja Pegawai</h2>
        <p className="text-text-muted text-sm">
          Belum ada pegawai aktif. Tambahkan pegawai dulu di menu Pegawai.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="font-heading text-2xl text-primary">Jadwal Kerja Pegawai</h2>
        <p className="text-sm text-text-muted mt-1">
          Pilih shift per hari untuk tiap pegawai. Tersedia 4 shift baku, atau pilih "Kustom" untuk
          atur jam manual.
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {SHIFT_PRESETS.filter((p) => p.id !== "custom").map((p) => (
            <span key={p.id} className="px-2 py-1 rounded-full bg-batik-gold/20 text-wood-dark">
              {p.label}
            </span>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-primary/40 bg-primary/5 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-primary">Generate Jadwal Otomatis</p>
            <p className="text-xs text-text-muted mt-1 max-w-xl">
              Susun jadwal shift untuk semua jabatan (Kasir, Bar, Kitchen, Waitres) sekaligus dari
              data pegawai aktif saat ini: 6 hari kerja/1 libur bergantian (libur tidak pernah di
              akhir pekan), Kasir di-backup Kapten saat libur, Kapten tanpa jam tetap, Sekuriti
              selalu Shift Malam.
            </p>
          </div>
          <button
            onClick={runAutoGenerate}
            disabled={isPending}
            className="shrink-0 bg-primary text-white px-4 py-2 rounded-md font-semibold disabled:opacity-50"
          >
            🔄 Generate Otomatis
          </button>
        </div>
        {autoMessage && <p className="text-sm mt-3">{autoMessage}</p>}
        {autoResult && (
          <div className="mt-3 space-y-2 text-sm">
            {autoResult.summary.length > 0 && (
              <ul className="list-disc list-inside text-text-muted">
                {autoResult.summary.map((s) => (
                  <li key={s.position}>
                    <span className="font-semibold text-text">{s.position}</span> ({s.employeeCount}{" "}
                    pegawai) — {s.note}
                  </li>
                ))}
              </ul>
            )}
            {autoResult.warnings.length > 0 && (
              <div className="rounded-md bg-batik-gold/10 border border-batik-gold/40 p-2">
                <p className="font-semibold text-xs mb-1">⚠️ Perlu perhatian:</p>
                <ul className="list-disc list-inside text-xs text-text-muted">
                  {autoResult.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {employees.map((emp) => (
          <section
            key={emp.id}
            className="rounded-md border border-border bg-surface dark:bg-surface-dark p-4"
          >
            <div className="flex justify-between items-center mb-3">
              <p className="font-semibold">
                {emp.full_name} <span className="text-text-muted text-sm">({emp.employee_code})</span>
              </p>
              <button
                onClick={() => saveEmployeeRow(emp.id)}
                disabled={isPending}
                className="text-sm px-3 py-1.5 rounded-md bg-primary text-white font-semibold disabled:opacity-50"
              >
                Simpan Jadwal
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
              {DISPLAY_DAYS.map((day) => {
                const cell = state[emp.id][day.value];
                const selectValue = cell.isOff ? "off" : cell.shiftPreset || "";
                return (
                  <div key={day.value} className="border border-border rounded-md p-2">
                    <p className="text-xs font-semibold text-text-muted mb-1">{day.label}</p>
                    <select
                      value={selectValue}
                      onChange={(e) => selectShift(emp.id, day.value, e.target.value)}
                      className="w-full border border-border rounded text-xs p-1 bg-background dark:bg-background-dark mb-1"
                    >
                      <option value="" disabled>
                        Pilih...
                      </option>
                      <option value="off">Libur</option>
                      {SHIFT_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.id === "custom" ? "Kustom" : p.label.split(" (")[0]}
                        </option>
                      ))}
                    </select>

                    {!cell.isOff && cell.shiftPreset === "custom" && (
                      <div className="space-y-1">
                        <input
                          type="time"
                          value={cell.shiftStart}
                          onChange={(e) => updateManualTime(emp.id, day.value, { shiftStart: e.target.value })}
                          className="w-full border border-border rounded text-xs p-1 bg-background dark:bg-background-dark"
                        />
                        <input
                          type="time"
                          value={cell.shiftEnd}
                          onChange={(e) => updateManualTime(emp.id, day.value, { shiftEnd: e.target.value })}
                          className="w-full border border-border rounded text-xs p-1 bg-background dark:bg-background-dark"
                        />
                      </div>
                    )}

                    {!cell.isOff && cell.shiftPreset && cell.shiftPreset !== "custom" && (
                      <p className="text-[10px] text-text-muted text-center">
                        {cell.shiftStart} – {cell.shiftEnd === "00:00" ? "24:00" : cell.shiftEnd}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {savedStatus[emp.id] && (
              <p className="text-xs text-text-muted mt-2">{savedStatus[emp.id]}</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
