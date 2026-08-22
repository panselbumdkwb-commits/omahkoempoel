"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { mobileClockAction, submitLeaveAction } from "./actions";
import CameraCapture from "@/components/CameraCapture";

type Employee = { id: string; full_name: string };

export default function AbsenClient({ employees }: { employees: Employee[] }) {
  const [mode, setMode] = useState<"hadir" | "izin">("hadir");
  const [employeeId, setEmployeeId] = useState("");
  const [pin, setPin] = useState("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [cameraFor, setCameraFor] = useState<"in" | "out" | null>(null);

  function getLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Perangkat tidak mendukung lokasi GPS. Gunakan kios di Kedai untuk absen."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error("Izin lokasi ditolak/gagal diambil. Aktifkan GPS & izinkan akses lokasi untuk absen masuk/pulang.")), {
        enableHighAccuracy: true,
        timeout: 10000,
      });
    });
  }

  function clock(action: "in" | "out", photoDataUrl?: string | null) {
    if (!employeeId) {
      setResult({ ok: false, text: "Pilih nama kamu dulu." });
      return;
    }
    if (!pin) {
      setResult({ ok: false, text: "Masukkan PIN kamu." });
      return;
    }
    setCameraFor(null);
    setResult(null);
    setLocating(true);
    startTransition(async () => {
      try {
        const pos = await getLocation();
        const res = await mobileClockAction(employeeId, pin, action, pos.coords.latitude, pos.coords.longitude, photoDataUrl ?? null);
        setResult({ ok: true, text: res.message });
        setPin("");
      } catch (err: any) {
        setResult({ ok: false, text: err.message ?? "Gagal absen." });
      } finally {
        setLocating(false);
      }
    });
  }

  function submitLeave() {
    if (!employeeId) {
      setResult({ ok: false, text: "Pilih nama kamu dulu." });
      return;
    }
    if (!pin) {
      setResult({ ok: false, text: "Masukkan PIN kamu." });
      return;
    }
    setResult(null);
    startTransition(async () => {
      try {
        const res = await submitLeaveAction(employeeId, pin, reason);
        setResult({ ok: true, text: res.message });
        setPin("");
        setReason("");
      } catch (err: any) {
        setResult({ ok: false, text: err.message ?? "Gagal mengajukan izin." });
      }
    });
  }

  return (
    <main className="min-h-screen bg-wood-dark flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-parchment rounded-2xl shadow-xl p-6">
        <h1 className="font-ukir text-2xl text-wood-dark mb-1 text-center">Absen Mandiri</h1>
        <p className="text-sm text-wood-mid text-center mb-4">Kedai Omah Koempoel — lewat HP pribadi</p>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setMode("hadir")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === "hadir" ? "bg-sogan text-parchment" : "bg-white text-wood-dark border border-wood-light"}`}
          >
            Absen Masuk/Pulang
          </button>
          <button
            onClick={() => setMode("izin")}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === "izin" ? "bg-sogan text-parchment" : "bg-white text-wood-dark border border-wood-light"}`}
          >
            Ajukan Izin
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-wood-mid mb-1">Nama Kamu</label>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full border border-wood-light rounded-lg p-2.5 bg-white">
              <option value="">Pilih nama</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name}
                </option>
              ))}
            </select>
            {employees.length === 0 && (
              <p className="text-xs text-danger mt-1">
                Belum ada akun terverifikasi.{" "}
                <Link href="/pegawai/daftar" className="underline font-semibold">
                  Daftar dulu di sini
                </Link>
                .
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs text-wood-mid mb-1">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full border border-wood-light rounded-lg p-2.5 bg-white tracking-widest text-center"
            />
          </div>

          {mode === "hadir" ? (
            <>
              <p className="text-xs text-wood-mid">
                Absen masuk hanya bisa dilakukan dalam radius 10 meter dari Kedai — pastikan GPS aktif.
              </p>
              <div className="flex gap-2">
                <button onClick={() => (employeeId && pin ? setCameraFor("in") : clock("in"))} disabled={isPending} className="flex-1 bg-success text-white font-jakarta font-bold py-3 rounded-lg disabled:opacity-60">
                  {locating && isPending ? "Mengambil lokasi..." : "Absen Masuk"}
                </button>
                <button onClick={() => (employeeId && pin ? setCameraFor("out") : clock("out"))} disabled={isPending} className="flex-1 bg-accent text-white font-jakarta font-bold py-3 rounded-lg disabled:opacity-60">
                  Absen Pulang
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs text-wood-mid mb-1">Alasan Izin</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full border border-wood-light rounded-lg p-2.5 bg-white" />
              </div>
              <p className="text-xs text-wood-mid">Pengajuan izin boleh dikirim dari mana saja.</p>
              <button onClick={submitLeave} disabled={isPending} className="w-full bg-sogan text-parchment font-jakarta font-bold py-3 rounded-lg disabled:opacity-60">
                Kirim Pengajuan Izin
              </button>
            </>
          )}

          {result && (
            <p className={`text-sm text-center font-semibold ${result.ok ? "text-success" : "text-danger"}`}>{result.text}</p>
          )}
        </div>
      </div>

      {cameraFor && (
        <CameraCapture
          title={cameraFor === "in" ? "Foto Absen Masuk" : "Foto Absen Pulang"}
          onCapture={(dataUrl) => clock(cameraFor, dataUrl)}
          onSkip={() => clock(cameraFor, null)}
        />
      )}
    </main>
  );
}
