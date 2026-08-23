"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { mobileClockAction, submitLeaveAction } from "./actions";
import CameraCapture from "@/components/CameraCapture";

type Employee = { id: string; full_name: string };

export default function AbsenClient({ employee }: { employee: Employee }) {
  const [mode, setMode] = useState<"hadir" | "izin">("hadir");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [locating, setLocating] = useState(false);
  const [cameraFor, setCameraFor] = useState<"in" | "out" | null>(null);

  // Prompt "Tambah ke Layar Utama" (Android/Chrome). Di iOS Safari tombol ini
  // tidak muncul karena iOS belum mendukung event ini — instruksi manual
  // ditampilkan sebagai gantinya (lihat isIOS di bawah).
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
    setInstalled(standalone);
    setIsIOS(/iphone|ipad|ipod/i.test(window.navigator.userAgent) && !standalone);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function handleInstallClick() {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.finally(() => setInstallPrompt(null));
  }

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
    setCameraFor(null);
    setResult(null);
    setLocating(true);
    startTransition(async () => {
      try {
        const pos = await getLocation();
        const res = await mobileClockAction(action, pos.coords.latitude, pos.coords.longitude, photoDataUrl ?? null);
        setResult({ ok: true, text: res.message });
      } catch (err: any) {
        setResult({ ok: false, text: err.message ?? "Gagal absen." });
      } finally {
        setLocating(false);
      }
    });
  }

  function submitLeave() {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await submitLeaveAction(reason);
        setResult({ ok: true, text: res.message });
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
        <p className="text-sm text-wood-mid text-center mb-1">Kedai Omah Koempoel — lewat HP pribadi</p>
        <p className="text-sm font-semibold text-wood-dark text-center mb-4">Halo, {employee.full_name} 👋</p>

        {!installed && installPrompt && (
          <button
            onClick={handleInstallClick}
            className="w-full mb-4 flex items-center justify-center gap-2 bg-wood-dark text-parchment text-sm font-semibold py-2.5 rounded-lg"
          >
            📲 Tambah ke Layar Utama HP
          </button>
        )}
        {!installed && isIOS && (
          <p className="text-xs text-wood-mid text-center mb-4 bg-white border border-wood-light rounded-lg p-2.5">
            Di iPhone: buka menu <span className="font-semibold">Bagikan</span> (ikon kotak dengan panah ke atas) lalu
            pilih <span className="font-semibold">Tambah ke Layar Utama</span> supaya bisa dibuka langsung seperti
            aplikasi.
          </p>
        )}

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
          {mode === "hadir" ? (
            <>
              <p className="text-xs text-wood-mid">
                Absen masuk hanya bisa dilakukan dalam radius 10 meter dari Kedai — pastikan GPS aktif.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setCameraFor("in")} disabled={isPending} className="flex-1 bg-success text-white font-jakarta font-bold py-3 rounded-lg disabled:opacity-60">
                  {locating && isPending ? "Mengambil lokasi..." : "Absen Masuk"}
                </button>
                <button onClick={() => setCameraFor("out")} disabled={isPending} className="flex-1 bg-accent text-white font-jakarta font-bold py-3 rounded-lg disabled:opacity-60">
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

        <div className="mt-5 pt-4 border-t border-wood-light text-center">
          <Link href="/pegawai/akun" className="text-xs text-wood-mid underline font-semibold">
            Akun Saya / Ganti Password / Keluar
          </Link>
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
