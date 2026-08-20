"use client";

import { useEffect, useState, useTransition } from "react";
import { formatJakartaDateTime } from "@/lib/timezone";
import {
  createComponentAction,
  toggleComponentAction,
  runPayrollAction,
  listPayrollItemsAction,
  approvePayrollPeriodAction,
  updatePositionSalaryAction,
  createExpenseAction,
  updateExpenseValueAction,
  toggleExpenseAction,
  computeMonthlyExpenseTotalAction,
  recordExpenseEntryAction,
  listExpenseEntriesForMonthAction,
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
type ExpenseCategory = "utility" | "social" | "other";
type ExpenseCalcType = "fixed" | "percent_of_revenue" | "variable_manual";
type Expense = {
  id: string;
  name: string;
  category: ExpenseCategory;
  calc_type: ExpenseCalcType;
  value: number;
  is_active: boolean;
};
type ExpenseBreakdownRow = {
  name: string;
  category: ExpenseCategory;
  calc_type: ExpenseCalcType;
  value: number;
  amount: number;
  recorded: boolean;
};

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

const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  utility: "Utilitas",
  social: "Sosial",
  other: "Lainnya",
};

export default function PayrollClient({
  components,
  periods,
  positions,
  expenses,
}: {
  components: Component[];
  periods: Period[];
  positions: Position[];
  expenses: Expense[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [items, setItems] = useState<any[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const [expenseCheckStart, setExpenseCheckStart] = useState("");
  const [expenseCheckEnd, setExpenseCheckEnd] = useState("");
  const [expenseResult, setExpenseResult] = useState<{ breakdown: ExpenseBreakdownRow[]; total: number; revenue: number } | null>(null);
  const [expensePending, startExpenseTransition] = useTransition();

  // Pencatatan biaya variable_manual (Listrik/Air) — nominalnya beda tiap
  // bulan sesuai pemakaian, jadi dicatat manual per bulan kalender, bukan
  // diedit sebagai "nilai tetap" seperti Internet/Kebersihan.
  const [recordMonth, setRecordMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [monthlyEntries, setMonthlyEntries] = useState<Record<string, number>>({});
  const [entriesLoading, setEntriesLoading] = useState(false);

  useEffect(() => {
    setEntriesLoading(true);
    listExpenseEntriesForMonthAction(recordMonth)
      .then((map) => setMonthlyEntries(map))
      .catch((err: any) => setMessage(`Gagal memuat catatan biaya: ${err.message}`))
      .finally(() => setEntriesLoading(false));
  }, [recordMonth]);

  function saveExpenseEntry(expenseId: string, amount: number) {
    const fd = new FormData();
    fd.set("expenseId", expenseId);
    fd.set("periodMonth", recordMonth);
    fd.set("amount", String(amount));
    startTransition(async () => {
      try {
        await recordExpenseEntryAction(fd);
        setMonthlyEntries((cur) => ({ ...cur, [expenseId]: amount }));
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  function checkExpenseTotal() {
    if (!expenseCheckStart || !expenseCheckEnd) {
      setMessage("Isi tanggal mulai & selesai dulu untuk menghitung total biaya operasional.");
      return;
    }
    startExpenseTransition(async () => {
      try {
        const result = await computeMonthlyExpenseTotalAction(expenseCheckStart, expenseCheckEnd);
        setExpenseResult(result);
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

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

      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5 print:hidden">
        <h2 className="font-heading text-xl text-primary mb-2">Gaji Pokok per Jabatan</h2>
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

      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5 print:hidden">
        <h2 className="font-heading text-xl text-primary mb-2">Biaya Operasional Bulanan</h2>
        <p className="text-xs text-text-muted mb-4">
          Biaya rutin di luar gaji pegawai. <span className="font-semibold">Listrik</span> &{" "}
          <span className="font-semibold">Air</span> nominalnya berubah tiap bulan sesuai pemakaian,
          jadi dicatat manual per bulan (bukan angka tetap) — lihat bagian "Catat Tagihan Bulan Ini"
          di bawah. "Cadangan Kebutuhan Sosial" dihitung sebagai persentase dari omset bulan berjalan.
        </p>
        <div className="divide-y divide-border mb-4">
          {expenses
            .filter((e) => e.calc_type !== "variable_manual")
            .map((e) => (
              <div key={e.id} className="py-2 flex justify-between items-center text-sm gap-2">
                <div>
                  <span>{e.name}</span>
                  <span className="ml-2 text-xs text-text-muted">({EXPENSE_CATEGORY_LABEL[e.category]})</span>
                  {!e.is_active && <span className="ml-2 text-xs text-text-muted">(nonaktif)</span>}
                </div>
                <div className="flex gap-2 items-center">
                  <form
                    action={(fd) =>
                      startTransition(async () => {
                        try {
                          await updateExpenseValueAction(fd);
                        } catch (err: any) {
                          setMessage(`Gagal: ${err.message}`);
                        }
                      })
                    }
                    className="flex gap-1 items-center"
                  >
                    <input type="hidden" name="id" value={e.id} />
                    <input
                      name="value"
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={e.value}
                      className="w-28 border border-border rounded-md p-1.5 bg-background dark:bg-background-dark text-sm"
                    />
                    <span className="text-xs text-text-muted">{e.calc_type === "percent_of_revenue" ? "%" : "Rp"}</span>
                    <button type="submit" className="text-xs px-2 py-1.5 rounded-md border border-border">
                      Simpan
                    </button>
                  </form>
                  <button
                    onClick={() => startTransition(() => toggleExpenseAction(e.id, e.is_active))}
                    className="text-xs px-2 py-1.5 rounded-md border border-border"
                  >
                    {e.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </button>
                </div>
              </div>
            ))}
        </div>

        {expenses.some((e) => e.calc_type === "variable_manual") && (
          <div className="rounded-md border border-border p-3 mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm font-semibold">Catat Tagihan Bulan Ini (Listrik, Air, dll)</p>
              <input
                type="month"
                value={recordMonth}
                onChange={(e) => setRecordMonth(e.target.value)}
                className="border border-border rounded-md p-1.5 bg-background dark:bg-background-dark text-sm"
              />
            </div>
            <div className="divide-y divide-border">
              {expenses
                .filter((e) => e.calc_type === "variable_manual")
                .map((e) => (
                  <VariableExpenseRow
                    key={e.id}
                    expense={e}
                    amount={monthlyEntries[e.id] ?? 0}
                    recorded={Object.prototype.hasOwnProperty.call(monthlyEntries, e.id)}
                    loading={entriesLoading}
                    onSave={(amount) => saveExpenseEntry(e.id, amount)}
                    onToggle={() => startTransition(() => toggleExpenseAction(e.id, e.is_active))}
                  />
                ))}
            </div>
            <p className="text-xs text-text-muted mt-2">
              Tagihan yang dicatat di sini otomatis dipakai saat "Hitung Total" & saat Slip Gaji /
              laporan biaya operasional dibuat untuk bulan yang sama.
            </p>
          </div>
        )}

        <form action={createExpenseAction} className="grid grid-cols-2 gap-2 mb-4">
          <input name="name" placeholder="Nama biaya (mis. Sewa Tempat)" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2" />
          <select name="category" className="border border-border rounded-md p-2 bg-background dark:bg-background-dark">
            <option value="utility">Utilitas</option>
            <option value="social">Sosial</option>
            <option value="other">Lainnya</option>
          </select>
          <select name="calcType" className="border border-border rounded-md p-2 bg-background dark:bg-background-dark">
            <option value="fixed">Nominal Tetap (Rp/bulan)</option>
            <option value="variable_manual">Variabel — dicatat manual tiap bulan (mis. Listrik, Air)</option>
            <option value="percent_of_revenue">Persen dari Omset Bulan</option>
          </select>
          <input
            name="value"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            placeholder="Nilai (Rp/%, abaikan kalau pilih Variabel)"
            className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2"
          />
          <button type="submit" className="bg-primary text-white py-2 rounded-md font-semibold col-span-2">
            Tambah Biaya
          </button>
        </form>

        <div className="border-t border-border pt-4">
          <p className="text-sm font-semibold mb-2">Cek Total Biaya Operasional per Bulan</p>
          <div className="flex flex-wrap gap-2 items-end mb-3">
            <div>
              <label className="text-xs block mb-1">Dari Tanggal</label>
              <input
                type="date"
                value={expenseCheckStart}
                onChange={(e) => setExpenseCheckStart(e.target.value)}
                className="border border-border rounded-md p-2 bg-background dark:bg-background-dark text-sm"
              />
            </div>
            <div>
              <label className="text-xs block mb-1">Sampai Tanggal</label>
              <input
                type="date"
                value={expenseCheckEnd}
                onChange={(e) => setExpenseCheckEnd(e.target.value)}
                className="border border-border rounded-md p-2 bg-background dark:bg-background-dark text-sm"
              />
            </div>
            <button
              type="button"
              onClick={checkExpenseTotal}
              disabled={expensePending}
              className="bg-secondary text-white px-4 py-2 rounded-md text-sm font-semibold disabled:opacity-50"
            >
              Hitung Total
            </button>
          </div>
          {expenseResult && (
            <div className="rounded-md border border-border p-3 text-sm space-y-1">
              {expenseResult.breakdown.map((b, i) => (
                <div key={i} className="flex justify-between">
                  <span>
                    {b.name}
                    {b.calc_type === "percent_of_revenue" && (
                      <span className="text-xs text-text-muted"> ({b.value}% x omset {formatRupiah(expenseResult.revenue)})</span>
                    )}
                    {b.calc_type === "variable_manual" && !b.recorded && (
                      <span className="text-xs text-danger"> (belum dicatat)</span>
                    )}
                  </span>
                  <span>{formatRupiah(b.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between font-bold text-primary border-t border-border pt-1 mt-1">
                <span>Total</span>
                <span>{formatRupiah(expenseResult.total)}</span>
              </div>
            </div>
          )}
        </div>
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

/** 1 baris biaya variable_manual (Listrik/Air) di dalam kartu "Catat
 * Tagihan Bulan Ini" — input terkontrol lokal supaya angka yang sedang
 * diketik tidak hilang saat re-render, tapi tetap sinkron ulang setiap
 * kali `amount`/bulan yang dipilih berubah (lihat key={recordMonth} di
 * pemanggilnya kalau perlu reset paksa; di sini cukup useEffect). */
function VariableExpenseRow({
  expense,
  amount,
  recorded,
  loading,
  onSave,
  onToggle,
}: {
  expense: Expense;
  amount: number;
  recorded: boolean;
  loading: boolean;
  onSave: (amount: number) => void;
  onToggle: () => void;
}) {
  const [value, setValue] = useState(String(amount));

  useEffect(() => {
    setValue(String(amount));
  }, [amount]);

  return (
    <div className="py-2 flex justify-between items-center text-sm gap-2">
      <div>
        <span>{expense.name}</span>
        <span className="ml-2 text-xs text-text-muted">({EXPENSE_CATEGORY_LABEL[expense.category]})</span>
        {!expense.is_active && <span className="ml-2 text-xs text-text-muted">(nonaktif)</span>}
        {!recorded && !loading && <span className="ml-2 text-xs text-danger">belum dicatat bulan ini</span>}
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={loading}
          placeholder="Nominal tagihan"
          className="w-32 border border-border rounded-md p-1.5 bg-background dark:bg-background-dark text-sm disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => onSave(Number(value) || 0)}
          disabled={loading}
          className="text-xs px-2 py-1.5 rounded-md bg-primary text-white font-semibold disabled:opacity-50"
        >
          Simpan
        </button>
        <button type="button" onClick={onToggle} className="text-xs px-2 py-1.5 rounded-md border border-border">
          {expense.is_active ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </div>
    </div>
  );
}
