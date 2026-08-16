"use client";

import { useState, useTransition } from "react";
import { createUserAction, updateUserRoleAction, toggleUserStatusAction } from "./actions";

type Role = { id: string; code: string; name: string };
type UserRow = {
  id: string;
  full_name: string;
  phone: string | null;
  status: string;
  created_at: string;
  roles: { code: string; name: string } | { code: string; name: string }[] | null;
};

function roleName(u: UserRow) {
  const r = u.roles;
  if (!r) return "-";
  return Array.isArray(r) ? r[0]?.name ?? "-" : r.name;
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function UsersClient({ users, roles }: { users: UserRow[]; roles: Role[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState(generatePassword());
  const [isPending, startTransition] = useTransition();

  function handleCreate(fd: FormData) {
    startTransition(async () => {
      try {
        await createUserAction(fd);
        setMessage(
          `Akun berhasil dibuat. Email: ${fd.get("email")} — Password sementara: ${fd.get(
            "password"
          )} (catat sekarang, tidak ditampilkan lagi).`
        );
        setGeneratedPassword(generatePassword());
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h2 className="font-heading text-2xl text-primary">Kelola User</h2>

      {message && (
        <div className="rounded-md bg-surface dark:bg-surface-dark border border-border p-3 text-sm">
          {message}
        </div>
      )}

      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <h3 className="font-heading text-lg text-primary mb-4">Tambah Akun Baru</h3>
        <form action={handleCreate} className="grid grid-cols-2 gap-2">
          <input
            name="fullName"
            placeholder="Nama lengkap (mis. Staf Dapur 1)"
            required
            className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2"
          />
          <input
            name="email"
            type="email"
            placeholder="Email login (mis. dapur1@omahkoempoel.dev)"
            required
            className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2"
          />
          <div className="col-span-2 flex gap-2 items-center">
            <input
              name="password"
              value={generatedPassword}
              onChange={(e) => setGeneratedPassword(e.target.value)}
              className="flex-1 border border-border rounded-md p-2 bg-background dark:bg-background-dark font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setGeneratedPassword(generatePassword())}
              className="text-xs px-3 py-2 rounded-md border border-border"
            >
              Acak Ulang
            </button>
          </div>
          <select name="roleId" required className="border border-border rounded-md p-2 bg-background dark:bg-background-dark col-span-2">
            <option value="">Pilih role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="bg-primary text-white py-2 rounded-md font-semibold col-span-2 disabled:opacity-50"
          >
            Buat Akun
          </button>
        </form>
        <p className="text-xs text-text-muted mt-2">
          Catat password sementara ini dan berikan ke pegawai secara langsung/aman — sistem tidak
          menyimpannya dalam bentuk yang bisa ditampilkan ulang. Fitur ganti password oleh pegawai
          sendiri menyusul di fase berikutnya.
        </p>
      </section>

      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <h3 className="font-heading text-lg text-primary mb-4">Daftar User</h3>
        <div className="divide-y divide-border">
          {users.map((u) => (
            <div key={u.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-semibold">
                  {u.full_name}
                  {u.status !== "active" && <span className="ml-2 text-xs text-danger">Nonaktif</span>}
                </p>
                <p className="text-sm text-text-muted">{roleName(u)}</p>
              </div>
              <div className="flex gap-2 items-center">
                <form action={(fd) => startTransition(() => updateUserRoleAction(fd))} className="flex gap-2">
                  <input type="hidden" name="profileId" value={u.id} />
                  <select
                    name="roleId"
                    defaultValue={roles.find((r) => r.code === (Array.isArray(u.roles) ? u.roles[0]?.code : u.roles?.code))?.id ?? ""}
                    className="text-sm border border-border rounded-md p-1.5 bg-background dark:bg-background-dark"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="text-xs px-2 py-1.5 rounded-md border border-border">
                    Ubah Role
                  </button>
                </form>
                <button
                  onClick={() => startTransition(() => toggleUserStatusAction(u.id, u.status))}
                  className="text-xs px-2 py-1.5 rounded-md border border-border"
                >
                  {u.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
