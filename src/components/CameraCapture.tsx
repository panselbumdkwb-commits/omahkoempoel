"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Kamera selfie untuk absensi (Kiosk & Absen Mandiri HP). Fotonya HANYA
 * untuk verifikasi MANUAL oleh Admin/Owner — sistem ini TIDAK melakukan
 * pencocokan wajah otomatis/AI (lihat catatan privasi Bagian 31 master
 * prompt & komentar migration 0023). Kamera & mikrofon tidak direkam,
 * hanya 1 foto diam yang diambil saat pengguna menekan tombol.
 *
 * Selalu ada opsi "Lewati" supaya presensi tidak terhambat kalau kamera
 * tidak tersedia/izin ditolak — foto bersifat pelengkap, bukan wajib.
 */
export default function CameraCapture({
  title,
  onCapture,
  onSkip,
}: {
  title: string;
  onCapture: (dataUrl: string) => void;
  onSkip: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setReady(true);
        }
      })
      .catch(() => setError("Kamera tidak tersedia atau izin ditolak. Anda tetap bisa lanjut tanpa foto."));

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCapture(dataUrl);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-surface dark:bg-surface-dark rounded-2xl p-5 max-w-sm w-full text-center">
        <h3 className="font-heading text-lg text-primary mb-1">{title}</h3>
        <p className="text-xs text-text-muted mb-3">
          Foto untuk verifikasi manual oleh Admin/Owner — bukan pengenalan wajah otomatis.
        </p>
        {error ? (
          <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-sm mb-3">{error}</div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full aspect-[4/3] object-cover rounded-xl bg-black mb-3 scale-x-[-1]"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2">
          <button
            onClick={handleCapture}
            disabled={!ready}
            className="flex-1 bg-primary text-white py-2.5 rounded-xl font-bold disabled:opacity-40"
          >
            📸 Ambil Foto
          </button>
          <button onClick={onSkip} className="flex-1 border border-border py-2.5 rounded-xl font-semibold">
            Lewati
          </button>
        </div>
      </div>
    </div>
  );
}
