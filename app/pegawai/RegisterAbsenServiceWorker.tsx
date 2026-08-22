"use client";

import { useEffect } from "react";

/**
 * Mendaftarkan service worker untuk PWA "Absen Mandiri" — scope dibatasi ke
 * /pegawai/ saja (lihat public/pegawai-sw.js) supaya tidak memengaruhi
 * halaman Admin/Kasir/Kiosk sama sekali. Tanpa efek visual — cuma
 * pendaftaran di background supaya Chrome/Android menawarkan "Tambah ke
 * Layar Utama" / bisa dijadikan APK internal lewat PWABuilder.
 */
export default function RegisterAbsenServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/pegawai-sw.js", { scope: "/pegawai/" }).catch(() => {
      // Diam-diam gagal (mis. browser lama) — halaman tetap berfungsi
      // normal tanpa fitur "install", absensi tidak terganggu.
    });
  }, []);

  return null;
}
