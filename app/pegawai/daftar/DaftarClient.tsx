"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { submitRegistrationAction } from "./actions";

export default function DaftarClient() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  function submit(fd: FormData) {
    startTransition(async () => {
      try {
        await submitRegistrationAction(fd);
        setStatus("success");
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message ?? "Gagal mengirim pendaftaran.");
      }
    });
  }

  return (
    <main className="min-h-screen bg-wood-dark flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-parchment rounded-2xl shadow-xl p-6">
        <h1 className="font-ukir text-2xl text-wood-dark mb-1 text-center">Pendaftaran Akun Absensi</h1>
        <p className="text-sm text-wood-mid text-center mb-5">Kedai Omah Koempoel</p>

        {status === "success" ? (
          <div className="text-center space-y-3">
            <p className="text-4xl">✅</p>
            <p className="font-semibold text-wood-dark">Pendaftaran terkirim!</p>
            <p className="text-sm text-wood-mid">
              Tunggu verifikasi dari Captain/Admin/Owner. Setelah disetujui, kamu akan diberi
              username &amp; password untuk login di halaman{" "}
              <Link href="/pegawai/login" className="underline font-semibold">
                Login Absen Mandiri
              </Link>
              .
            </p>
          </div>
        ) : (
          <form action={submit} className="space-y-3">
            <div>
              <label className="block text-xs text-wood-mid mb-1">Nama Lengkap</label>
              <input name="fullName" required className="w-full border border-wood-light rounded-lg p-2.5 bg-white" />
            </div>
            <div>
              <label className="block text-xs text-wood-mid mb-1">Nomor HP (WhatsApp aktif)</label>
              <input name="phone" required type="tel" className="w-full border border-wood-light rounded-lg p-2.5 bg-white" />
            </div>
            <div>
              <label className="block text-xs text-wood-mid mb-1">Jabatan (kalau tahu)</label>
              <input name="claimedPositionName" className="w-full border border-wood-light rounded-lg p-2.5 bg-white" />
            </div>
            <div>
              <label className="block text-xs text-wood-mid mb-1">Kode Pegawai (kalau sudah pernah didata)</label>
              <input name="claimedEmployeeCode" className="w-full border border-wood-light rounded-lg p-2.5 bg-white" />
            </div>
            {status === "error" && <p className="text-sm text-danger">{message}</p>}
            <button type="submit" disabled={isPending} className="w-full bg-sogan text-parchment font-jakarta font-bold py-3 rounded-lg disabled:opacity-60">
              {isPending ? "Mengirim..." : "Daftar"}
            </button>
            <p className="text-xs text-wood-mid text-center pt-2">
              Sudah punya akun?{" "}
              <Link href="/pegawai/login" className="underline font-semibold">
                Login di sini
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
