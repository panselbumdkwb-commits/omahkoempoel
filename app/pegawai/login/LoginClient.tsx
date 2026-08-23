"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { loginMobileAction } from "./actions";

export default function LoginClient() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      try {
        await loginMobileAction(fd);
      } catch (err: any) {
        // redirect() dari server action melempar error khusus Next.js
        // (NEXT_REDIRECT) yang HARUS dibiarkan lewat, bukan ditangkap
        // sebagai kegagalan login.
        if (err?.digest?.startsWith?.("NEXT_REDIRECT")) throw err;
        setError(err.message ?? "Gagal login.");
      }
    });
  }

  return (
    <main className="min-h-screen bg-wood-dark flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-parchment rounded-2xl shadow-xl p-6">
        <h1 className="font-ukir text-2xl text-wood-dark mb-1 text-center">Login Absen Mandiri</h1>
        <p className="text-sm text-wood-mid text-center mb-5">Kedai Omah Koempoel — lewat HP pribadi</p>

        <form action={submit} className="space-y-3">
          <div>
            <label className="block text-xs text-wood-mid mb-1">Username</label>
            <input
              name="username"
              required
              autoComplete="username"
              className="w-full border border-wood-light rounded-lg p-2.5 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-wood-mid mb-1">Password</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-wood-light rounded-lg p-2.5 bg-white"
            />
          </div>

          {error && <p className="text-sm text-danger text-center font-semibold">{error}</p>}

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-sogan text-parchment font-jakarta font-bold py-3 rounded-lg disabled:opacity-60"
          >
            {isPending ? "Masuk..." : "Masuk"}
          </button>

          <p className="text-xs text-wood-mid text-center pt-2">
            Login ini cuma sekali — HP kamu akan tetap masuk untuk absen selanjutnya. Belum punya
            akun?{" "}
            <Link href="/pegawai/daftar" className="underline font-semibold">
              Daftar dulu di sini
            </Link>
            . Lupa password? Minta Admin/Owner/Captain untuk reset lewat menu Pegawai.
          </p>
        </form>
      </div>
    </main>
  );
}
