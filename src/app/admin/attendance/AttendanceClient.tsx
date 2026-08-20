"use client";

import { useMemo, useState, useTransition } from "react";
import { recordAttendanceAction, getAttendanceByDateAction } from "../employees/actions";

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

const STATUS_BADGE: Record<string, string> = {
  present: "bg-success/15 text-success",
  late: "bg-warning/15 text-warning",
  absent: "bg-danger/15 text-danger",
  leave: "bg-secondary/15 text-secondary dark:text-secondary-dark",
  sick: "bg-danger/10 text-danger",
  early_leave: "bg-warning/10 text-warning",
};

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function shiftDate(date: string, days: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AttendanceClient({
  employees,
  attendance,
  date: initialDate,
  readOnly = false,
}: {
  employees: Employee[];
  attendance: AttendanceRow[];
  date: string;
  readOnly?: boolean;
}) {
  const [date, setDate] = useState(initialDate);
  const [rows, setRows] = useState<AttendanceRow[]>(attendance);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoadingDate, startDateTransition] = useTransition();

  const today = new Date().toISOString().slice(0, 10);
  const activeEmployees = employees.filter((e) => e.status === "active");
  const attendanceMap = useMemo(() => new Map(rows.map((a) => [a.employee_id, a])), [rows]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {
      present: 0,
      late: 0,
      absent: 0,
      leave: 0,
      sick: 0,
      early_leave: 0,
    };
    for (const e of activeEmployees) {
      const status = attendanceMap.get(e.id)?.status ?? "present";
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [activeEmployees, attendanceMap]);

  function loadDate(newDate: string) {
    setDate(newDate);
    startDateTransition(async () => {
      try {
        const data = await getAttendanceByDateAction(newDate);
        setRows(data as AttendanceRow[]);
        setMessage(null);
      } catch (err: any) {
        setMessage(`Gagal memuat: ${err.message}`);
      }
    });
  }

  function submitAttendance(fd: FormData) {
    startTransition(async () => {
      try {
        await recordAttendanceAction(fd);
        setMessage("Absensi tersimpan.");
        const data = await getAttendanceByDateAction(date);
        setRows(data as AttendanceRow[]);
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">Sumber Daya Manusia</p>
          <h2 className="font-heading text-2xl sm:text-3xl text-primary">📋 Absensi Pegawai</h2>
        </div>
        {readOnly && (
          <span className="badge-modern bg-accent/15 text-accent">Mode lihat-saja (Captain)</span>
        )}
      </div>

      {/* NAVIGASI TANGGAL */}
      <div className="card-modern p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadDate(shiftDate(date, -1))}
            className="btn-ghost-modern px-3 py-2"
            title="Hari sebelumnya"
          >
            ←
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => loadDate(e.target.value)}
            className="border border-border rounded-xl px-3 py-2 text-sm bg-background dark:bg-background-dark"
          />
          <button
            onClick={() => loadDate(shiftDate(date, 1))}
            className="btn-ghost-modern px-3 py-2"
            title="Hari berikutnya"
          >
            →
          </button>
          {date !== today && (
            <button onClick={() => loadDate(today)} className="pill-nav-link pill-nav-link-inactive border border-border">
              Hari Ini
            </button>
          )}
        </div>
        <p className="text-sm font-semibold text-text-muted">{formatDateLabel(date)}</p>
      </div>

      {/* RINGKASAN */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <SummaryCard label="Hadir" value={summary.present} tone="success" />
        <SummaryCard label="Terlambat" value={summary.late} tone="warning" />
        <SummaryCard label="Ijin" value={summary.leave} tone="secondary" />
        <SummaryCard label="Sakit" value={summary.sick} tone="danger" />
        <SummaryCard label="Pulang Cepat" value={summary.early_leave} tone="warning" />
        <SummaryCard label="Tidak Hadir" value={summary.absent} tone="danger" />
      </div>

      {!readOnly && (
        <div className="rounded-xl bg-accent/5 border border-accent/20 p-3 space-y-1.5">
          <p className="text-xs text-text-muted">
            Pencatatan manual oleh Admin/Owner. Untuk absensi mandiri oleh pegawai lewat tablet, buka{" "}
            <a href="/kiosk/attendance" target="_blank" className="text-primary underline font-semibold">
              Mode Kios
            </a>{" "}
            (pegawai perlu PIN — atur lewat halaman Pegawai).
          </p>
          <p className="text-xs text-text-muted">
            Potongan otomatis di payroll: Ijin −Rp30.000/hari, Sakit −Rp20.000/hari, Terlambat
            −Rp5.000 per akumulasi 60 menit (isi kolom "Menit Telat" saat status Terlambat).
          </p>
        </div>
      )}
      {readOnly && (
        <p className="text-xs text-text-muted">
          Untuk mencatat/mengubah absensi (termasuk ijin & keterlambatan), hubungi Admin/Owner.
        </p>
      )}

      {message && (
        <div className="rounded-xl bg-surface dark:bg-surface-dark border border-border p-3 text-sm animate-float-in">
          {message}
        </div>
      )}

      <div className={`card-modern divide-y divide-border overflow-hidden ${isLoadingDate ? "opacity-50" : ""}`}>
        {activeEmployees.length === 0 && (
          <p className="p-4 text-sm text-text-muted">Belum ada pegawai aktif.</p>
        )}
        {activeEmployees.map((e) => {
          const existing = attendanceMap.get(e.id);
          const status = existing?.status ?? "present";

          if (readOnly) {
            return (
              <div key={e.id} className="p-4 flex justify-between items-center gap-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                    {initials(e.full_name)}
                  </span>
                  <span className="font-semibold">{e.full_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge-modern ${STATUS_BADGE[status] ?? "bg-background text-text-muted"}`}>
                    {STATUS_LABEL[status] ?? status}
                    {status === "late" && existing?.late_minutes ? ` (${existing.late_minutes} menit)` : ""}
                  </span>
                  {(existing?.clock_in || existing?.clock_out) && (
                    <span className="text-xs text-text-muted">
                      {existing?.clock_in ? existing.clock_in.slice(11, 16) : "-"}
                      {" – "}
                      {existing?.clock_out ? existing.clock_out.slice(11, 16) : "-"}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          return (
            <form
              key={e.id}
              action={submitAttendance}
              className="p-4 grid grid-cols-2 sm:grid-cols-7 gap-2 items-center"
            >
              <input type="hidden" name="employeeId" value={e.id} />
              <input type="hidden" name="date" value={date} />
              <div className="flex items-center gap-2 col-span-2 sm:col-span-2">
                <span className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px] shrink-0">
                  {initials(e.full_name)}
                </span>
                <span className="font-semibold text-sm truncate">{e.full_name}</span>
              </div>
              <select
                name="status"
                defaultValue={status}
                className="border border-border rounded-lg p-1.5 text-sm bg-background dark:bg-background-dark"
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
                className="border border-border rounded-lg p-1.5 text-sm bg-background dark:bg-background-dark"
              />
              <input
                type="time"
                name="clockOut"
                defaultValue={existing?.clock_out ? existing.clock_out.slice(11, 16) : ""}
                className="border border-border rounded-lg p-1.5 text-sm bg-background dark:bg-background-dark"
              />
              <input
                type="number"
                min={0}
                name="lateMinutes"
                defaultValue={existing?.late_minutes ?? ""}
                placeholder="Menit Telat"
                className="border border-border rounded-lg p-1.5 text-sm bg-background dark:bg-background-dark"
              />
              <button type="submit" disabled={isPending} className="btn-primary-modern py-1.5 text-xs">
                Simpan
              </button>
            </form>
          );
        })}
      </div>
    </div>
  );
}

const SUMMARY_TONE_CLASS: Record<string, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  secondary: "text-secondary dark:text-secondary-dark",
};

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="stat-card-modern p-3">
      <p className="text-text-muted text-[11px] font-medium">{label}</p>
      <p className={`font-heading text-xl ${SUMMARY_TONE_CLASS[tone] ?? "text-primary"}`}>{value}</p>
    </div>
  );
}
