"use client";

import { useState, useTransition } from "react";
import { recordAttendanceAction } from "../employees/actions";

type Employee = { id: string; full_name: string | null; employee_code: string; status: string };
type AttendanceRow = {
  id: string;
  employee_id: string;
  clock_in: string | null;
  clock_out: string | null;
  status: string;
  notes: string | null;
  late_minutes?: number | null;
};

const STATUS_LABEL: Record<string, string> = {
  present: "Hadir",
  late: "Terlambat",
  absent: "Tidak Hadir",
  leave: "Ijin",
  sick: "Sakit",
  early_leave: "Pulang Cepat",
};

export default function AttendanceClient({
  employees,
  attendance,
  date,
}: {
  employees: Employee[];
  attendance: AttendanceRow[];
  date: string;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const attendanceMap = new Map(attendance.map((a) => [a.employee_id, a]));

  function submitAttendance(fd: FormData) {
    startTransition(async () => {
      try {
        await recordAttendanceAction(fd);
        setMessage("Absensi tersimpan.");
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h2 className="font-heading text-2xl text-primary">Absensi — {date}</h2>
      <p className="text-xs text-text-muted">
        Pencatatan manual oleh Admin/Owner. Untuk absensi mandiri oleh pegawai lewat tablet, buka{" "}
        <a href="/kiosk/attendance" target="_blank" className="text-primary underline">
          Mode Kios
        </a>{" "}
        (pegawai perlu PIN — atur lewat halaman Pegawai).
      </p>
      <p className="text-xs text-text-muted">
        Potongan otomatis di payroll: Ijin −Rp30.000/hari, Sakit −Rp20.000/hari, Terlambat
        −Rp5.000 per akumulasi 60 menit (isi kolom "Menit Telat" di bawah saat status Terlambat).
      </p>

      {message && (
        <div className="rounded-md bg-surface dark:bg-surface-dark border border-border p-3 text-sm">
          {message}
        </div>
      )}

      <div className="rounded-md border border-border bg-surface dark:bg-surface-dark divide-y divide-border">
        {employees
          .filter((e) => e.status === "active")
          .map((e) => {
            const existing = attendanceMap.get(e.id);
            return (
              <form
                key={e.id}
                action={submitAttendance}
                className="p-4 grid grid-cols-2 sm:grid-cols-6 gap-2 items-center"
              >
                <input type="hidden" name="employeeId" value={e.id} />
                <input type="hidden" name="date" value={date} />
                <span className="font-semibold col-span-2 sm:col-span-1">{e.full_name}</span>
                <select
                  name="status"
                  defaultValue={existing?.status ?? "present"}
                  className="border border-border rounded-md p-1.5 text-sm bg-background dark:bg-background-dark"
                >
                  {Object.entries(STATUS_LABEL).map(([v, label]) => (
                    <option key={v} value={v}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  name="clockIn"
                  defaultValue={existing?.clock_in ? existing.clock_in.slice(11, 16) : ""}
                  className="border border-border rounded-md p-1.5 text-sm bg-background dark:bg-background-dark"
                />
                <input
                  type="time"
                  name="clockOut"
                  defaultValue={existing?.clock_out ? existing.clock_out.slice(11, 16) : ""}
                  className="border border-border rounded-md p-1.5 text-sm bg-background dark:bg-background-dark"
                />
                <input
                  type="number"
                  min={0}
                  name="lateMinutes"
                  defaultValue={existing?.late_minutes ?? ""}
                  placeholder="Menit Telat"
                  className="border border-border rounded-md p-1.5 text-sm bg-background dark:bg-background-dark"
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="text-sm px-3 py-1.5 rounded-md bg-primary text-white font-semibold disabled:opacity-50"
                >
                  Simpan
                </button>
              </form>
            );
          })}
      </div>
    </div>
  );
}
