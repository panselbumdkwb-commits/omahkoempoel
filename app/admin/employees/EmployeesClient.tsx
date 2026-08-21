"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createPositionAction,
  createEmployeeAction,
  updateEmployeeAction,
  toggleEmployeeStatusAction,
  setEmployeePinAction,
  deleteEmployeeAction,
} from "./actions";

type Position = { id: string; name: string; default_basic_salary: number };
type Employee = {
  id: string;
  employee_code: string;
  full_name: string | null;
  phone: string | null;
  position_id: string | null;
  basic_salary: number;
  employment_type: "tetap" | "casual";
  daily_rate: number;
  status: string;
  join_date: string;
  employee_positions: { name: string } | { name: string }[] | null;
};

function formatRupiah(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}

function positionName(e: Employee) {
  const p = e.employee_positions;
  if (!p) return "-";
  return Array.isArray(p) ? p[0]?.name ?? "-" : p.name;
}

export default function EmployeesClient({
  employees,
  positions,
  employeeWorkHours,
  role,
}: {
  employees: Employee[];
  positions: Position[];
  employeeWorkHours: string;
  role: string;
}) {
  // Captain bisa mengelola data pegawai lainnya, TAPI gaji pokok tetap
  // wewenang SUPER_ADMIN/OWNER (migration 0018 juga mengunci ini di
  // level database lewat trigger, field readOnly di sini cuma lapisan
  // UX). Field tetap ikut ter-submit (readOnly, bukan disabled) supaya
  // nilai lama tidak ter-nol-kan saat Captain menyimpan perubahan lain.
  const isCaptain = role === "CAPTAIN";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pinEditId, setPinEditId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [filterPositionId, setFilterPositionId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [newPositionId, setNewPositionId] = useState("");
  const [newBasicSalary, setNewBasicSalary] = useState("");
  const [newEmploymentType, setNewEmploymentType] = useState<"tetap" | "casual">("tetap");

  function handleAction(action: () => Promise<void>, successMsg: string) {
    startTransition(async () => {
      try {
        await action();
        setMessage(successMsg);
        setEditingId(null);
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  function handleCreateEmployee(fd: FormData) {
    startTransition(async () => {
      try {
        await createEmployeeAction(fd);
        setMessage("Pegawai ditambahkan.");
        setNewPositionId("");
        setNewBasicSalary("");
        setNewEmploymentType("tetap");
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  function handleDelete(e: Employee) {
    const ok = window.confirm(
      `Hapus data pegawai "${e.full_name}" (${e.employee_code})? Data absensi & slip gaji lama tetap tersimpan untuk riwayat, tapi pegawai ini akan hilang dari daftar & jadwal kerja.`
    );
    if (!ok) return;
    handleAction(() => deleteEmployeeAction(e.id), `${e.full_name} dihapus dari daftar pegawai.`);
  }

  // Filter jabatan + pencarian nama/kode pegawai — supaya Owner/Admin
  // gampang menemukan pegawai tertentu tanpa scroll seluruh daftar.
  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (filterPositionId && e.position_id !== filterPositionId) return false;
      if (!q) return true;
      return (
        (e.full_name ?? "").toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q)
      );
    });
  }, [employees, filterPositionId, search]);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="rounded-md bg-batik-gold/10 border border-batik-gold/40 p-3 text-sm flex justify-between items-center gap-3">
        <span>
          🕐 <span className="font-semibold">Jam Kerja Pegawai:</span> {employeeWorkHours}
        </span>
        <a href="/admin/settings" className="text-primary underline whitespace-nowrap text-xs">
          Ubah di Pengaturan
        </a>
      </div>

      {message && (
        <div className="rounded-md bg-surface dark:bg-surface-dark border border-border p-3 text-sm">
          {message}
        </div>
      )}

      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <h2 className="font-heading text-xl text-primary mb-4">Jabatan</h2>
        <ul className="mb-4 flex flex-wrap gap-2">
          {positions.map((p) => (
            <li
              key={p.id}
              className="px-3 py-1.5 rounded-full bg-background dark:bg-background-dark border border-border text-sm"
            >
              {p.name} <span className="text-text-muted">· {formatRupiah(p.default_basic_salary)}/bulan</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-text-muted mb-2">
          Gaji pokok di sini otomatis dipakai untuk payroll seluruh pegawai TETAP di jabatan
          tersebut — tidak perlu diedit satu-satu per pegawai. Untuk mengubah acuan gaji pokok
          jabatan yang sudah ada, buka halaman{" "}
          <a href="/admin/payroll" className="text-primary underline">
            Payroll
          </a>
          .
        </p>
        <form
          action={(fd) => handleAction(() => createPositionAction(fd), "Jabatan ditambahkan.")}
          className="flex gap-2"
        >
          <input
            name="name"
            placeholder="Nama jabatan baru (mis. Kasir)"
            required
            className="flex-1 border border-border rounded-md p-2 bg-background dark:bg-background-dark"
          />
          <input
            name="defaultBasicSalary"
            type="number"
            min={0}
            placeholder="Gaji pokok"
            className="w-36 border border-border rounded-md p-2 bg-background dark:bg-background-dark"
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-white px-4 rounded-md font-semibold disabled:opacity-50"
          >
            Tambah
          </button>
        </form>
      </section>

      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <h2 className="font-heading text-xl text-primary mb-4">Data Pegawai</h2>

        {/* FILTER JABATAN + PENCARIAN — memudahkan mencari & mengedit data
            pegawai tanpa scroll seluruh daftar. */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <select
            value={filterPositionId}
            onChange={(e) => setFilterPositionId(e.target.value)}
            className="border border-border rounded-md p-2 bg-background dark:bg-background-dark text-sm sm:w-56"
          >
            <option value="">Semua Jabatan</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau kode pegawai..."
            className="flex-1 border border-border rounded-md p-2 bg-background dark:bg-background-dark text-sm"
          />
        </div>
        <p className="text-xs text-text-muted mb-3">
          Menampilkan {filteredEmployees.length} dari {employees.length} pegawai.
        </p>

        {filteredEmployees.length === 0 && (
          <p className="text-sm text-text-muted py-4">Tidak ada pegawai yang cocok dengan filter/pencarian ini.</p>
        )}
        <div className="divide-y divide-border">
          {filteredEmployees.map((e) => (
            <div key={e.id} className="py-3">
              {editingId === e.id ? (
                <form
                  action={(fd) => handleAction(() => updateEmployeeAction(fd), `${e.full_name} diperbarui.`)}
                  className="grid grid-cols-2 gap-2"
                >
                  <input type="hidden" name="id" value={e.id} />
                  <input
                    name="employeeCode"
                    defaultValue={e.employee_code}
                    required
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2"
                    placeholder="Kode pegawai (mis. EMP-002)"
                  />
                  <input
                    name="fullName"
                    defaultValue={e.full_name ?? ""}
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2"
                    placeholder="Nama lengkap"
                  />
                  <input
                    name="phone"
                    defaultValue={e.phone ?? ""}
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark"
                    placeholder="No. HP"
                  />
                  <select
                    name="positionId"
                    defaultValue={e.position_id ?? ""}
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark"
                  >
                    <option value="">Pilih jabatan</option>
                    {positions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    name="basicSalary"
                    type="number"
                    min={0}
                    defaultValue={e.basic_salary}
                    readOnly={isCaptain}
                    title={isCaptain ? "Gaji pokok hanya bisa diubah oleh Admin/Owner" : undefined}
                    className={`border border-border rounded-md p-2 bg-background dark:bg-background-dark ${
                      isCaptain ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    placeholder="Gaji pokok"
                  />
                  <select
                    name="employmentType"
                    defaultValue={e.employment_type}
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark"
                  >
                    <option value="tetap">Tetap (gaji bulanan)</option>
                    <option value="casual">Casual (upah harian)</option>
                  </select>
                  <input
                    name="dailyRate"
                    type="number"
                    min={0}
                    defaultValue={e.daily_rate}
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark"
                    placeholder="Upah harian (khusus Casual)"
                  />
                  <div className="col-span-2 flex gap-2">
                    <button
                      type="submit"
                      disabled={isPending}
                      className="bg-success text-white px-4 py-2 rounded-md font-semibold disabled:opacity-50"
                    >
                      Simpan
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-4 py-2 rounded-md border border-border"
                    >
                      Batal
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">
                      {e.full_name} <span className="text-xs text-text-muted">({e.employee_code})</span>
                      {e.status !== "active" && <span className="ml-2 text-xs text-danger">{e.status}</span>}
                      {e.employment_type === "casual" && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-batik-gold/20 text-batik-gold font-semibold">
                          Casual
                        </span>
                      )}
                    </p>
                    <p className="text-text-muted text-sm">
                      {positionName(e)} ·{" "}
                      {e.employment_type === "casual"
                        ? `${formatRupiah(e.daily_rate)}/hari`
                        : `${formatRupiah(e.basic_salary)}/bulan`}{" "}
                      · {e.phone || "-"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(e.id)} className="text-sm px-3 py-1.5 rounded-md border border-border">
                      Edit
                    </button>
                    <button
                      onClick={() => setPinEditId(pinEditId === e.id ? null : e.id)}
                      className="text-sm px-3 py-1.5 rounded-md border border-border"
                    >
                      Atur PIN
                    </button>
                    <button
                      onClick={() =>
                        handleAction(
                          () => toggleEmployeeStatusAction(e.id, e.status),
                          `${e.full_name} status diubah.`
                        )
                      }
                      className="text-sm px-3 py-1.5 rounded-md border border-border"
                    >
                      {e.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button
                      onClick={() => handleDelete(e)}
                      disabled={isPending}
                      className="text-sm px-3 py-1.5 rounded-md border border-danger text-danger disabled:opacity-50"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              )}
              {pinEditId === e.id && (
                <form
                  action={(fd) => handleAction(() => setEmployeePinAction(fd), `PIN ${e.full_name} diperbarui.`)}
                  className="mt-2 flex gap-2 items-center"
                >
                  <input type="hidden" name="id" value={e.id} />
                  <input
                    name="pin"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{4,6}"
                    placeholder="PIN baru (4-6 digit)"
                    required
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark text-sm"
                  />
                  <button type="submit" disabled={isPending} className="text-sm px-3 py-1.5 rounded-md bg-primary text-white font-semibold disabled:opacity-50">
                    Simpan PIN
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>

        <h3 className="font-heading text-lg text-primary mt-6 mb-3">Tambah Pegawai Baru</h3>
        <form action={handleCreateEmployee} className="grid grid-cols-2 gap-2">
          <input name="employeeCode" placeholder="Kode pegawai (mis. EMP-002)" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          <input name="fullName" placeholder="Nama lengkap" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          <input name="phone" placeholder="No. HP" className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          <select
            name="positionId"
            value={newPositionId}
            onChange={(ev) => {
              const posId = ev.target.value;
              setNewPositionId(posId);
              // Auto-isi gaji pokok dari acuan jabatan — tetap bisa diubah manual
              // di input Gaji Pokok sebelum submit.
              const pos = positions.find((p) => p.id === posId);
              if (pos) setNewBasicSalary(String(pos.default_basic_salary));
            }}
            className="border border-border rounded-md p-2 bg-background dark:bg-background-dark"
          >
            <option value="">Pilih jabatan</option>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            name="basicSalary"
            type="number"
            min={0}
            value={newBasicSalary}
            onChange={(ev) => setNewBasicSalary(ev.target.value)}
            readOnly={isCaptain}
            title={isCaptain ? "Gaji pokok mengikuti acuan jabatan, hanya Admin/Owner yang bisa ubah manual" : undefined}
            placeholder="Gaji pokok fallback (dipakai HANYA kalau belum ada jabatan)"
            required
            className={`border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2 ${
              isCaptain ? "opacity-60 cursor-not-allowed" : ""
            }`}
          />
          <select
            name="employmentType"
            value={newEmploymentType}
            onChange={(ev) => setNewEmploymentType(ev.target.value as "tetap" | "casual")}
            className="border border-border rounded-md p-2 bg-background dark:bg-background-dark"
          >
            <option value="tetap">Tetap (gaji bulanan)</option>
            <option value="casual">Casual (pengganti sementara, upah harian)</option>
          </select>
          <input
            name="dailyRate"
            type="number"
            min={0}
            placeholder={newEmploymentType === "casual" ? "Upah harian (wajib untuk Casual)" : "Upah harian (khusus Casual)"}
            required={newEmploymentType === "casual"}
            className="border border-border rounded-md p-2 bg-background dark:bg-background-dark"
          />
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-white py-2 rounded-md font-semibold col-span-2 disabled:opacity-50"
          >
            Tambah Pegawai
          </button>
        </form>
        <p className="text-xs text-text-muted mt-2">
          Pegawai <span className="font-semibold">Casual</span> adalah pengganti sementara untuk
          pegawai tetap yang tidak masuk — diupah harian (Upah Harian x jumlah hari hadir di periode
          payroll), bukan gaji pokok bulanan. Catat kehadirannya seperti biasa lewat halaman Absensi.
        </p>
        <p className="text-xs text-text-muted mt-2">
          Catatan: pegawai di sini belum tentu punya akun login. Untuk memberi akses login (mis.
          jadi Kasir di sistem), buat akun lewat Supabase Authentication lalu hubungkan manual ke
          baris pegawai ini (fitur penghubung otomatis menyusul).
        </p>
      </section>
    </div>
  );
}
