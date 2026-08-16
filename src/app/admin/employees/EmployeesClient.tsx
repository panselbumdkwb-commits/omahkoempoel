"use client";

import { useState, useTransition } from "react";
import {
  createPositionAction,
  createEmployeeAction,
  updateEmployeeAction,
  toggleEmployeeStatusAction,
} from "./actions";

type Position = { id: string; name: string };
type Employee = {
  id: string;
  employee_code: string;
  full_name: string | null;
  phone: string | null;
  position_id: string | null;
  basic_salary: number;
  status: string;
  join_date: string;
  employee_positions: { name: string } | { name: string }[] | null;
};

function positionName(e: Employee) {
  const p = e.employee_positions;
  if (!p) return "-";
  return Array.isArray(p) ? p[0]?.name ?? "-" : p.name;
}

export default function EmployeesClient({
  employees,
  positions,
}: {
  employees: Employee[];
  positions: Position[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
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
              {p.name}
            </li>
          ))}
        </ul>
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

        <div className="divide-y divide-border">
          {employees.map((e) => (
            <div key={e.id} className="py-3">
              {editingId === e.id ? (
                <form
                  action={(fd) => handleAction(() => updateEmployeeAction(fd), `${e.full_name} diperbarui.`)}
                  className="grid grid-cols-2 gap-2"
                >
                  <input type="hidden" name="id" value={e.id} />
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
                    className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2"
                    placeholder="Gaji pokok"
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
                    </p>
                    <p className="text-text-muted text-sm">
                      {positionName(e)} · Rp {Number(e.basic_salary).toLocaleString("id-ID")} · {e.phone || "-"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(e.id)} className="text-sm px-3 py-1.5 rounded-md border border-border">
                      Edit
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
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <h3 className="font-heading text-lg text-primary mt-6 mb-3">Tambah Pegawai Baru</h3>
        <form
          action={(fd) => handleAction(() => createEmployeeAction(fd), "Pegawai ditambahkan.")}
          className="grid grid-cols-2 gap-2"
        >
          <input name="employeeCode" placeholder="Kode pegawai (mis. EMP-002)" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          <input name="fullName" placeholder="Nama lengkap" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          <input name="phone" placeholder="No. HP" className="border border-border rounded-md p-2 bg-background dark:bg-background-dark" />
          <select name="positionId" className="border border-border rounded-md p-2 bg-background dark:bg-background-dark">
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
            placeholder="Gaji pokok"
            required
            className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2"
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
          Catatan: pegawai di sini belum tentu punya akun login. Untuk memberi akses login (mis.
          jadi Kasir di sistem), buat akun lewat Supabase Authentication lalu hubungkan manual ke
          baris pegawai ini (fitur penghubung otomatis menyusul).
        </p>
      </section>
    </div>
  );
}
