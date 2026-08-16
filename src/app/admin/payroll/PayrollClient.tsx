"use client";

import { useState, useTransition } from "react";
import {
  createComponentAction,
  toggleComponentAction,
  runPayrollAction,
  listPayrollItemsAction,
  approvePayrollPeriodAction,
} from "./actions";

type Component = {
  id: string;
  name: string;
  component_type: "earning" | "deduction";
  calc_type: "fixed" | "percent_of_basic";
  value: number;
  cap_base: number | null;
  is_active: boolean;
};
type Period = { id: string; period_start: string; period_end: string; status: string; created_at: string };

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

export default function PayrollClient({ components, periods }: { components: Component[]; periods: Period[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [items, setItems] = useState<any[] | null>(null);
  const [isPending, startTransition] = useTransition();

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

      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5 print:hidden">
        <h2 className="font-heading text-xl text-primary mb-2">Komponen Payroll (Configurable)</h2>
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
                {c.name} —{" "}
                {c.calc_type === "fixed" ? formatRupiah(c.value) : `${c.value}% dari gaji pokok`}
                {c.cap_base && ` (maks upah ${formatRupiah(c.cap_base)})`}
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
          <select name="calcType" className="border border-border rounded-md p-2 bg-background dark:bg-background-dark">
            <option value="fixed">Nominal Tetap (Rp)</option>
            <option value="percent_of_basic">Persen dari Gaji Pokok</option>
          </select>
          <input name="value" type="number" step="0.01" placeholder="Nilai (Rp atau %)" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          <input name="capBase" type="number" placeholder="Batas upah dasar (opsional)" className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          <button type="submit" className="bg-primary text-white py-2 rounded-md font-semibold col-span-2">
            Tambah Komponen
          </button>
        </form>
      </section>

      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5 print:hidden">
        <h2 className="font-heading text-xl text-primary mb-4">Jalankan Payroll</h2>
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

      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5 print:hidden">
        <h2 className="font-heading text-xl text-primary mb-4">Riwayat Periode Payroll</h2>
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
        <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5 print:border-0 print:bg-white print:p-0">
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
                    Dicetak: {new Date().toLocaleString("id-ID")}
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
