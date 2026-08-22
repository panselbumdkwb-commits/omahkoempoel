"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createExpenseAction,
  updateExpenseValueAction,
  toggleExpenseAction,
  updateExpenseTypeAction,
  computeMonthlyExpenseTotalAction,
  recordExpenseEntryAction,
  listExpenseEntriesForMonthAction,
} from "./actions";

type ExpenseCategory = "utility" | "social" | "other";
type ExpenseCalcType = "fixed" | "percent_of_revenue" | "variable_manual";
type ExpenseType = "operational" | "non_operational";
type Expense = {
  id: string;
  name: string;
  category: ExpenseCategory;
  calc_type: ExpenseCalcType;
  expense_type: ExpenseType;
  value: number;
  is_active: boolean;
};
type ExpenseBreakdownRow = {
  name: string;
  category: ExpenseCategory;
  calc_type: ExpenseCalcType;
  expense_type: ExpenseType;
  value: number;
  amount: number;
  recorded: boolean;
};

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  utility: "Utilitas",
  social: "Sosial",
  other: "Lainnya",
};

const EXPENSE_TYPE_LABEL: Record<ExpenseType, string> = {
  operational: "Operasional",
  non_operational: "Non-Operasional",
};

/**
 * Panel "Biaya Operasional & Non-Operasional" — bagian dari Laporan
 * Keuangan (bukan Payroll), sesuai standar akuntansi: pengupahan
 * pegawai (Payroll) dan biaya operasional/non-operasional cafe
 * adalah dua pos yang berbeda dalam Laporan Laba Rugi. Menu Payroll
 * hanya mencatat & menghitung upah pegawai (lihat halaman Payroll);
 * seluruh biaya lain dicatat & dikelola di sini, lalu otomatis masuk
 * ke perhitungan Laba Rugi pada bagian atas halaman Laporan.
 */
export default function OperationalExpensesPanel({ expenses }: { expenses: Expense[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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

  return (
    <section className="card-modern p-5 print:hidden">
      <h2 className="section-title-modern text-xl mb-2">Biaya Operasional &amp; Non-Operasional</h2>
      <p className="text-xs text-text-muted mb-4">
        Biaya rutin cafe di luar gaji pegawai (pengupahan pegawai dicatat khusus di menu Payroll).{" "}
        <span className="font-semibold">Listrik</span> &amp; <span className="font-semibold">Air</span>{" "}
        nominalnya berubah tiap bulan sesuai pemakaian, jadi dicatat manual per bulan (bukan angka
        tetap) — lihat bagian "Catat Tagihan Bulan Ini" di bawah. "Cadangan Kebutuhan Sosial" dihitung
        sebagai persentase dari omset bulan berjalan. Klasifikasi Operasional/Non-Operasional di sini
        menentukan baris mana pada Laporan Laba Rugi di atas yang dipakai.
      </p>
      {message && (
        <div className="rounded-md bg-surface dark:bg-surface-dark border border-border p-3 text-sm mb-4">
          {message}
        </div>
      )}
      <div className="divide-y divide-border mb-4">
        {expenses
          .filter((e) => e.calc_type !== "variable_manual")
          .map((e) => (
            <div key={e.id} className="py-2 flex justify-between items-center text-sm gap-2 flex-wrap">
              <div>
                <span>{e.name}</span>
                <span className="ml-2 text-xs text-text-muted">({EXPENSE_CATEGORY_LABEL[e.category]})</span>
                {!e.is_active && <span className="ml-2 text-xs text-text-muted">(nonaktif)</span>}
              </div>
              <div className="flex gap-2 items-center">
                <select
                  value={e.expense_type}
                  onChange={(ev) =>
                    startTransition(() => updateExpenseTypeAction(e.id, ev.target.value as ExpenseType))
                  }
                  title="Klasifikasi untuk Laporan Laba Rugi"
                  className={`text-xs px-2 py-1.5 rounded-full border font-semibold ${
                    e.expense_type === "operational"
                      ? "bg-secondary/10 text-secondary dark:text-secondary-dark border-secondary/30"
                      : "bg-warning/10 text-warning border-warning/30"
                  }`}
                >
                  <option value="operational">{EXPENSE_TYPE_LABEL.operational}</option>
                  <option value="non_operational">{EXPENSE_TYPE_LABEL.non_operational}</option>
                </select>
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
            Tagihan yang dicatat di sini otomatis dipakai saat "Hitung Total" &amp; saat Laporan Laba
            Rugi dihitung untuk bulan yang sama.
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
        <select
          name="expenseType"
          defaultValue="operational"
          title="Klasifikasi untuk Laporan Laba Rugi"
          className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2"
        >
          <option value="operational">Klasifikasi: Biaya Operasional (listrik, air, internet, dll)</option>
          <option value="non_operational">Klasifikasi: Biaya Non-Operasional (bunga bank, penyusutan, dll)</option>
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
  );
}

/** 1 baris biaya variable_manual (Listrik/Air) di dalam kartu "Catat
 * Tagihan Bulan Ini" — input terkontrol lokal supaya angka yang sedang
 * diketik tidak hilang saat re-render, tapi tetap sinkron ulang setiap
 * kali `amount`/bulan yang dipilih berubah. */
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
