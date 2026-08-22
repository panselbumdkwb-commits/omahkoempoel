import type { Metadata, Viewport } from "next";
import RegisterAbsenServiceWorker from "./RegisterAbsenServiceWorker";

// Metadata di sini HANYA berlaku untuk halaman di bawah /pegawai/* (App
// Router menggabungkan metadata per-segment) — tidak menimpa metadata utama
// aplikasi Admin/Kasir di app/layout.tsx.
export const metadata: Metadata = {
  title: "Absen Mandiri — Omah Koempoel",
  description: "Absensi mandiri pegawai Kedai Omah Koempoel lewat HP.",
  manifest: "/manifest-absen.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Absen Koempoel",
  },
  icons: {
    icon: "/icons/absen-favicon.png",
    apple: "/icons/absen-apple-touch.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#3E2723",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function PegawaiLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RegisterAbsenServiceWorker />
      {children}
    </>
  );
}
