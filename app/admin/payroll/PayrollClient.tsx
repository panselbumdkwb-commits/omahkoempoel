"use client";

import { useState, useTransition } from "react";
import { formatJakartaDateTime } from "@/lib/timezone";
import {
  createComponentAction,
  toggleComponentAction,
  runPayrollAction,
  listPayrollItemsAction,
  approvePayrollPeriodAction,
  updatePositionSalaryAction,
} from "./actions";

type CalcType =
  | "fixed"
  | "percent_of_basic"
  | "per_day_present"
  | "deduction_per_leave_day"
  | "deduction_per_sick_day"
  | "deduction_per_late_block"
  | "revenue_bonus_share";

type Component = {
  id: string;
  name: string;
  component_type: "earning" | "deduction";
  calc_type: CalcType;
  value: number;
  cap_base: number | null;
  is_active: boolean;
};
type Period = { id: string; period_start: string; period_end: string; status: string; created_at: string };
type Position = { id: string; name: string; default_basic_salary: number };

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

const CALC_TYPE_OPTIONS: { value: CalcType; label: string }[] = [
  { value: "fixed", label: "Nominal Tetap (Rp/bulan)" },
  { value: "percent_of_basic", label: "Persen dari Gaji Pokok" },
  { value: "per_day_present", label: "Rp per hari hadir (kompensasi makan harian)" },
  { value: "deduction_per_leave_day", label: "Potongan Rp per hari Ijin" },
  { value: "deduction_per_sick_day", label: "Potongan Rp per hari Sakit" },
  { value: "deduction_per_late_block", label: "Potongan Rp per akumulasi 60 menit terlambat" },
  { value: "revenue_bonus_share", label: "Bonus % dari (Omset bulan − ambang di Batas Upah)" },
];

function describeComponent(c: Component) {
  switch (c.calc_type) {
    case "fixed":
      return formatRupiah(c.value) + "/bulan";
    case "percent_of_basic":
      return `${c.value}% dari gaji pokok${c.cap_base ? ` (maks upah ${formatRupiah(c.cap_base)})` : ""}`;
    case "per_day_present":
      return `${formatRupiah(c.value)} x jumlah hari hadir`;
    case "deduction_per_leave_day":
      return `${formatRupiah(c.value)} x jumlah hari Ijin`;
    case "deduction_per_sick_day":
      return `${formatRupiah(c.value)} x jumlah hari Sakit`;
    case "deduction_per_late_block":
      return `${formatRupiah(c.value)} per akumulasi 60 menit terlambat`;
    case "revenue_bonus_share":
      return `${c.value}% dari (Omset bulan − ${formatRupiah(c.cap_base ?? 0)}), dibagi rata, min. Rp200.000/orang`;
    default:
      return "";
  }
}

export default function PayrollClient({
  components,
  periods,
  positions,
}: {
  components: Component[];
  periods: Period[];
  positions: Position[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [items, setItems] = useState<any[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);

  function openPeriod(id: string) {
    setSelectedPeriod(id);
    startTransition(async () => {
      const data = await listPayrollItemsAction(id);
      setItems(data);
    });
  }

  function runPayroll(fd: FormData) {
    startTransition(async () => {
      try {
        const period = await runPayrollAction(fd);
        setMessage(`Payroll periode ${period.period_start} s/d ${period.period_end} berhasil dihitung.`);
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {message && (
        <div className="rounded-md bg-surface dark:bg-surface-dark border border-border p-3 text-sm print:hidden">
          {message}
        </div>
      )}

      <section className="card-modern p-5 print:hidden">
        <h2 className="section-title-modern text-xl mb-2">Komponen Payroll (Configurable)</h2>
        <p className="text-xs text-text-muted mb-4">
          Semua formula gaji dihitung dari komponen ini — bukan hardcode. Nonaktifkan komponen yang
          tidak berlaku, atau tambah baru sesuai kebijakan cafe. Nilai BPJS default mengikuti
          ketentuan 2026 — selalu verifikasi ulang ke bpjsketenagakerjaan.go.id.
        </p>
        <div className="divide-y divide-border mb-4">
          {components.map((c) => (
            <div key={c.id} className="py-2 flex justify-between items-center text-sm">
              <div>
                <span className={c.component_type === "earning" ? "text-success" : "text-danger"}>
                  {c.component_type === "earning" ? "+" : "−"}
                </span>{" "}
                {c.name} — {describeComponent(c)}
                {!c.is_active && <span className="ml-2 text-xs text-text-muted">(nonaktif)</span>}
              </div>
              <button
                onClick={() => startTransition(() => toggleComponentAction(c.id, c.is_active))}
                className="text-xs px-2 py-1 rounded-md border border-border"
              >
                {c.is_active ? "Nonaktifkan" : "Aktifkan"}
              </button>
            </div>
          ))}
        </div>

        <form action={createComponentAction} className="grid grid-cols-2 gap-2">
          <input name="name" placeholder="Nama komponen" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2" />
          <select name="componentType" className="border border-border rounded-md p-2 bg-background dark:bg-background-dark">
            <option value="earning">Penambah (Earning)</option>
            <option value="deduction">Potongan (Deduction)</option>
          </select>
          <select name="calcType" className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2">
            {CALC_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input name="value" type="number" step="0.01" placeholder="Nilai (Rp atau %)" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          <input
            name="capBase"
            type="number"
            placeholder="Batas upah dasar / ambang omset (opsional)"
            className="border border-border rounded-md p-2 bg-background dark:bg-background-dark"
          />
          <button type="submit" className="bg-primary text-white py-2 rounded-md font-semibold col-span-2">
            Tambah Komponen
          </button>
        </form>
      </section>

      <section className="card-modern p-5 print:hidden">
        <h2 className="section-title-modern text-xl mb-2">Gaji Pokok per Jabatan</h2>
        <p className="text-xs text-text-muted mb-4">
          Acuan gaji pokok bulanan tiap jabatan.{" "}
          <span className="font-semibold">
            Payroll pegawai TETAP otomatis memakai angka di sini sesuai jabatan masing-masing
          </span>{" "}
          — jadi kalau nilainya diubah, seluruh pegawai jabatan tersebut ikut naik/turun mulai
          periode payroll berikutnya, tanpa perlu diedit satu-satu di halaman Pegawai. Gaji pokok
          per-pegawai di halaman Pegawai hanya jadi fallback untuk pegawai yang belum punya jabatan.
        </p>
        <div className="divide-y divide-border">
          {positions.map((p) => (
            <div key={p.id} className="py-2 flex justify-between items-center text-sm gap-2">
              <span>{p.name}</span>
              {editingPositionId === p.id ? (
                <form
                  action={(fd) =>
                    startTransition(async () => {
                      try {
                        await updatePositionSalaryAction(fd);
                        setEditingPositionId(null);
                      } catch (err: any) {
                        setMessage(`Gagal: ${err.message}`);
                      }
                    })
                  }
                  className="flex gap-2 items-center"
                >
                  <input type="hidden" name="id" value={p.id} />
                  <input
                    name="defaultBasicSalary"
                    type="number"
                    min={0}
                    defaultValue={p.default_basic_salary}
                    className="w-32 border border-border rounded-md p-1.5 bg-background dark:bg-background-dark text-sm"
                  />
                  <button type="submit" className="text-xs px-2 py-1.5 rounded-md bg-primary text-white font-semibold">
                    Simpan
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingPositionId(null)}
                    className="text-xs px-2 py-1.5 rounded-md border border-border"
                  >
                    Batal
                  </button>
                </form>
              ) : (
                <div className="flex gap-2 items-center">
                  <span className="font-semibold">{formatRupiah(p.default_basic_salary)}/bulan</span>
                  <button
                    onClick={() => setEditingPositionId(p.id)}
                    className="text-xs px-2 py-1.5 rounded-md border border-border"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
          {positions.length === 0 && (
            <p className="text-sm text-text-muted py-2">
              Belum ada jabatan. Tambah jabatan lewat halaman Pegawai.
            </p>
          )}
        </div>
      </section>

      <section className="card-modern p-5 print:hidden">
        <h2 className="section-title-modern text-xl mb-4">Jalankan Payroll</h2>
        <form action={runPayroll} className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs block mb-1">Periode Mulai</label>
            <input name="periodStart" type="date" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          </div>
          <div>
            <label className="text-xs block mb-1">Periode Selesai</label>
            <input name="periodEnd" type="date" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          </div>
          <button type="submit" disabled={isPending} className="bg-primary text-white px-4 py-2 rounded-md font-semibold disabled:opacity-50">
            Hitung Payroll Semua Pegawai Aktif
          </button>
        </form>
      </section>

      <section className="card-modern p-5 print:hidden">
        <h2 className="section-title-modern text-xl mb-4">Riwayat Periode Payroll</h2>
        <div className="divide-y divide-border">
          {periods.map((p) => (
            <button key={p.id} onClick={() => openPeriod(p.id)} className="w-full text-left py-2 flex justify-between text-sm hover:text-primary">
              <span>
                {p.period_start} s/d {p.period_end}
              </span>
              <span className="text-text-muted">{p.status}</span>
            </button>
          ))}
        </div>
      </section>

      {selectedPeriod && items && (
        <section className="card-modern p-5 print:border-0 print:bg-white print:p-0 print:shadow-none">
          {/* CSS khusus printer thermal (lebar 80mm) — sama seperti nota/
              tiket dapur di /print, hanya berlaku saat benar-benar mencetak. */}
          <style>{`
            @media print {
              @page { size: 80mm auto; margin: 3mm; }
              body { width: 80mm; background: white; }
            }
          `}</style>

          <div className="flex justify-between items-center mb-4 print:hidden">
            <h2 className="font-heading text-xl text-primary">Slip Gaji</h2>
            <div className="flex gap-2">
              <button
                onClick={() => startTransition(() => approvePayrollPeriodAction(selectedPeriod))}
                className="text-sm px-3 py-1.5 rounded-md border border-border"
              >
                Approve Periode
              </button>
              <button onClick={() => window.print()} className="text-sm px-3 py-1.5 rounded-md border border-border">
                🖨️ Cetak (80mm Thermal)
              </button>
            </div>
          </div>

          <div className="space-y-6 print:space-y-0">
            {items.map((item: any, idx: number) => {
              const period = periods.find((p) => p.id === selectedPeriod);
              const isLast = idx === items.length - 1;
              return (
                <div
                  key={item.id}
                  className={`border border-border rounded-md p-4 break-inside-avoid print:border-0 print:rounded-none print:w-[72mm] print:mx-auto print:p-2 print:font-mono print:text-xs print:leading-tight ${
                    isLast ? "" : "print:break-after-page"
                  }`}
                >
                  <p className="text-center font-bold print:text-sm">OMAH KOEMPOEL</p>
                  <p className="text-center text-text-muted print:text-[10px] print:mb-2">Slip Gaji Karyawan</p>
                  {period && (
                    <p className="text-center text-xs text-text-muted print:text-[10px] print:mb-2">
                      Periode {period.period_start} s/d {period.period_end}
                    </p>
                  )}
                  <hr className="hidden print:block border-black my-2" />

                  <p className="font-semibold mb-2 print:mb-1 print:font-bold">
                    {item.employees?.full_name} ({item.employees?.employee_code})
                  </p>
                  <table className="w-full text-sm print:text-xs mb-2">
                    <tbody>
                      <tr>
                        <td className="py-1">Gaji Pokok</td>
                        <td className="py-1 text-right">{formatRupiah(item.basic_salary)}</td>
                      </tr>
                      {item.earnings_breakdown.map((e: any, i: number) => (
                        <tr key={i}>
                          <td className="py-1 text-success print:text-black">+ {e.name}</td>
                          <td className="py-1 text-right text-success print:text-black">{formatRupiah(e.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border font-semibold">
                        <td className="py-1">Gaji Kotor</td>
                        <td className="py-1 text-right">{formatRupiah(item.gross_salary)}</td>
                      </tr>
                      {item.deductions_breakdown.map((d: any, i: number) => (
                        <tr key={i}>
                          <td className="py-1 text-danger print:text-black">− {d.name}</td>
                          <td className="py-1 text-right text-danger print:text-black">{formatRupiah(d.amount)}</td>
                        </tr>
                      ))}
                      <tr className="border-t border-border font-bold text-primary print:text-black">
                        <td className="py-1">Take Home Pay</td>
                        <td className="py-1 text-right">{formatRupiah(item.net_salary)}</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="hidden print:block text-center text-[10px] mt-2">
                    Dicetak: {formatJakartaDateTime(new Date())}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

