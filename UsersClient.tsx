"use client";

import { useState, useTransition } from "react";
import {
  createUserAction,
  updateUserRoleAction,
  toggleUserStatusAction,
  updateUserProfileAction,
  resetUserPasswordAction,
  updateUserEmailAction,
  deleteUserAction,
} from "./actions";

type Role = { id: string; code: string; name: string };
type UserRow = {
  id: string;
  full_name: string;
  email: string;
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
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [userList, setUserList] = useState(users);

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

  function deleteUser(u: UserRow) {
    if (!confirm(`Hapus akun "${u.full_name}" (${u.email})? Akun ini tidak akan bisa login lagi setelah dihapus.`)) return;
    startTransition(async () => {
      try {
        await deleteUserAction(u.id);
        setUserList((cur) => cur.filter((row) => row.id !== u.id));
        setMessage(`Akun ${u.full_name} dihapus.`);
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
          {userList.map((u) => (
            <div key={u.id} className="py-3 flex justify-between items-center">
              <div>
                <p className="font-semibold">
                  {u.full_name}
                  {u.status !== "active" && <span className="ml-2 text-xs text-danger">Nonaktif</span>}
                </p>
                <p className="text-sm text-text-muted">{roleName(u)}</p>
                <p className="text-xs text-text-muted">{u.email || "(email tidak ditemukan)"}</p>
              </div>
              <div className="flex gap-2 items-center">
                <button
                  onClick={() => setEditingUser(u)}
                  className="text-xs px-2 py-1.5 rounded-md border border-border font-semibold text-primary"
                >
                  Edit
                </button>
                <button
                  onClick={() => startTransition(() => toggleUserStatusAction(u.id, u.status))}
                  className="text-xs px-2 py-1.5 rounded-md border border-border"
                >
                  {u.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button
                  onClick={() => deleteUser(u)}
                  className="text-xs px-2 py-1.5 rounded-md border border-danger/40 text-danger"
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
          {userList.length === 0 && <p className="text-sm text-text-muted py-2">Belum ada user.</p>}
        </div>
      </section>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={roles}
          onClose={() => setEditingUser(null)}
          onEmailSaved={(newEmail) =>
            setUserList((cur) => cur.map((row) => (row.id === editingUser.id ? { ...row, email: newEmail } : row)))
          }
        />
      )}
    </div>
  );
}

function EditUserModal({
  user,
  roles,
  onClose,
  onEmailSaved,
}: {
  user: UserRow;
  roles: Role[];
  onClose: () => void;
  onEmailSaved: (newEmail: string) => void;
}) {
  const currentRoleCode = Array.isArray(user.roles) ? user.roles[0]?.code : user.roles?.code;
  const [fullName, setFullName] = useState(user.full_name);
  const [roleId, setRoleId] = useState(roles.find((r) => r.code === currentRoleCode)?.id ?? "");
  const [email, setEmail] = useState(user.email);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function saveProfile() {
    const fd = new FormData();
    fd.set("profileId", user.id);
    fd.set("fullName", fullName);
    fd.set("roleId", roleId);
    startTransition(async () => {
      try {
        await updateUserProfileAction(fd);
        setProfileMsg("Nama & role tersimpan.");
      } catch (err: any) {
        setProfileMsg(`Gagal: ${err.message}`);
      }
    });
  }

  function saveEmail() {
    const fd = new FormData();
    fd.set("profileId", user.id);
    fd.set("email", email);
    startTransition(async () => {
      try {
        await updateUserEmailAction(fd);
        setEmailMsg("Email login tersimpan.");
        onEmailSaved(email.trim());
      } catch (err: any) {
        setEmailMsg(`Gagal: ${err.message}`);
      }
    });
  }

  function savePassword() {
    if (newPassword.length < 8) {
      setPasswordMsg("Password minimal 8 karakter.");
      return;
    }
    const fd = new FormData();
    fd.set("profileId", user.id);
    fd.set("newPassword", newPassword);
    startTransition(async () => {
      try {
        await resetUserPasswordAction(fd);
        setPasswordMsg(`Password berhasil direset ke: ${newPassword} (catat sekarang, berikan ke pegawai secara langsung/aman).`);
      } catch (err: any) {
        setPasswordMsg(`Gagal: ${err.message}`);
      }
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center bg-black/50">
      <div className="w-full sm:max-w-md bg-surface dark:bg-surface-dark rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="p-5 flex justify-between items-center border-b border-border">
          <h3 className="font-heading text-lg text-primary">Edit User</h3>
          <button onClick={onClose} className="text-sm text-text-muted">
            Tutup
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold">Nama & Role</p>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nama lengkap"
              className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark"
            />
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </select>
            <button
              onClick={saveProfile}
              disabled={isPending}
              className="w-full bg-primary text-white py-2 rounded-md font-semibold disabled:opacity-50"
            >
              Simpan Nama & Role
            </button>
            {profileMsg && <p className="text-xs text-text-muted">{profileMsg}</p>}
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold">Email Login</p>
            <p className="text-xs text-text-muted">
              Login memakai email, bukan username — pastikan email ini benar & aktif.
            </p>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="Email login"
              className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark"
            />
            <button
              onClick={saveEmail}
              disabled={isPending || !email.trim()}
              className="w-full bg-primary text-white py-2 rounded-md font-semibold disabled:opacity-50"
            >
              Simpan Email
            </button>
            {emailMsg && <p className="text-xs text-text-muted">{emailMsg}</p>}
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-semibold">Reset Password</p>
            <div className="flex gap-2">
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Password baru (min. 8 karakter)"
                className="flex-1 border border-border rounded-md p-2 bg-background dark:bg-background-dark font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setNewPassword(generatePassword())}
                className="text-xs px-3 py-2 rounded-md border border-border"
              >
                Acak
              </button>
            </div>
            <button
              onClick={savePassword}
              disabled={isPending}
              className="w-full bg-secondary text-white py-2 rounded-md font-semibold disabled:opacity-50"
            >
              Reset Password
            </button>
            {passwordMsg && <p className="text-xs text-text-muted">{passwordMsg}</p>}
            <p className="text-xs text-text-muted">
              Password baru tidak disimpan dalam bentuk yang bisa ditampilkan ulang — catat &amp;
              sampaikan ke pegawai sekarang juga.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
