"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { changePasswordAction, logoutMobileAction } from "./actions";

export default function AkunClient({ fullName }: { fullName: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(fd: FormData) {
    setResult(null);
    startTransition(async () => {
      try {
        await changePasswordAction(fd);
        setResult({ ok: true, text: "Password berhasil diganti." });
        (document.getElementById("change-password-form") as HTMLFormElement | null)?.reset();
      } catch (err: any) {
        if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
        setResult({ ok: false, text: err.message ?? "Gagal mengganti password." });
      }
    });
  }

  function logout() {
    startTransition(async () => {
      await logoutMobileAction();
    });
  }

  return (
    <main className="min-h-screen bg-wood-dark flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-parchment rounded-2xl shadow-xl p-6">
        <h1 className="font-ukir text-2xl text-wood-dark mb-1 text-center">Akun Saya</h1>
        <p className="text-sm text-wood-mid text-center mb-5">{fullName}</p>

        <form id="change-password-form" action={submit} className="space-y-3">
          <p className="text-sm font-semibold text-wood-dark">Ganti Password</p>
          <div>
            <label className="block text-xs text-wood-mid mb-1">Password Lama</label>
            <input
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-wood-light rounded-lg p-2.5 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-wood-mid mb-1">Password Baru (min. 8 karakter)</label>
            <input
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border border-wood-light rounded-lg p-2.5 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-wood-mid mb-1">Ulangi Password Baru</label>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full border border-wood-light rounded-lg p-2.5 bg-white"
            />
          </div>

          {result && (
            <p className={`text-sm text-center font-semibold ${result.ok ? "text-success" : "text-danger"}`}>
              {result.text}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-sogan text-parchment font-jakarta font-bold py-3 rounded-lg disabled:opacity-60"
          >
            Simpan Password Baru
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-wood-light space-y-3">
          <Link
            href="/pegawai/absen"
            className="block w-full text-center border border-wood-light text-wood-dark font-semibold py-2.5 rounded-lg"
          >
            Kembali ke Absen Mandiri
          </Link>
          <button
            onClick={logout}
            disabled={isPending}
            className="w-full text-center text-danger font-semibold py-2 disabled:opacity-60"
          >
            Keluar dari akun ini
          </button>
        </div>
      </div>
    </main>
  );
}
