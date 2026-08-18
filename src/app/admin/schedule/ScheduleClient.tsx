"use client";

import { useState, useTransition } from "react";
import { upsertScheduleEntryAction } from "./actions";

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

type DayState = { shiftStart: string; shiftEnd: string; isOff: boolean };

function buildInitialState(employees: Employee[], schedule: ScheduleRow[]) {
  const state: Record<string, Record<number, DayState>> = {};
  for (const emp of employees) {
    state[emp.id] = {};
    for (const day of DISPLAY_DAYS) {
      const existing = schedule.find((s) => s.employee_id === emp.id && s.day_of_week === day.value);
      state[emp.id][day.value] = {
        shiftStart: existing?.shift_start?.slice(0, 5) ?? "",
        shiftEnd: existing?.shift_end?.slice(0, 5) ?? "",
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

  function updateCell(employeeId: string, day: number, patch: Partial<DayState>) {
    setState((prev) => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [day]: { ...prev[employeeId][day], ...patch },
      },
    }));
  }

  function saveEmployeeRow(employeeId: string) {
    setSavedStatus((s) => ({ ...s, [employeeId]: "" }));
    startTransition(async () => {
      try {
        for (const day of DISPLAY_DAYS) {
          const cell = state[employeeId][day.value];
          await upsertScheduleEntryAction({
            employeeId,
            dayOfWeek: day.value,
            shiftStart: cell.isOff ? null : cell.shiftStart || null,
            shiftEnd: cell.isOff ? null : cell.shiftEnd || null,
            isOff: cell.isOff,
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
          Atur jam kerja mingguan per pegawai. Centang "Libur" untuk hari pegawai tidak masuk.
        </p>
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
                return (
                  <div key={day.value} className="border border-border rounded-md p-2">
                    <p className="text-xs font-semibold text-text-muted mb-1">{day.label}</p>
                    <label className="flex items-center gap-1 text-xs mb-2">
                      <input
                        type="checkbox"
                        checked={cell.isOff}
                        onChange={(e) => updateCell(emp.id, day.value, { isOff: e.target.checked })}
                      />
                      Libur
                    </label>
                    {!cell.isOff && (
                      <div className="space-y-1">
                        <input
                          type="time"
                          value={cell.shiftStart}
                          onChange={(e) => updateCell(emp.id, day.value, { shiftStart: e.target.value })}
                          className="w-full border border-border rounded text-xs p-1 bg-background dark:bg-background-dark"
                        />
                        <input
                          type="time"
                          value={cell.shiftEnd}
                          onChange={(e) => updateCell(emp.id, day.value, { shiftEnd: e.target.value })}
                          className="w-full border border-border rounded text-xs p-1 bg-background dark:bg-background-dark"
                        />
                      </div>
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
