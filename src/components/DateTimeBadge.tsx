"use client";

import { useEffect, useState } from "react";

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

/** Ambil komponen tanggal/jam versi WIB, apa pun zona waktu perangkat/server
 * yang menjalankannya (dipakai bareng saat mengubah offset lewat Intl agar
 * konsisten dengan util formatJakartaDateTime di lib/timezone.ts). */
function getJakartaParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekdayIdx = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(
    get("weekday")
  );

  return {
    dayName: DAY_NAMES[weekdayIdx] ?? get("weekday"),
    day: get("day").padStart(2, "0"),
    monthNum: get("month").padStart(2, "0"),
    month: MONTH_NAMES[Number(get("month")) - 1] ?? get("month"),
    year: get("year"),
    hour: get("hour") === "24" ? "00" : get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

type Props = {
  /** "full" = Hari, Tanggal Bulan Tahun · HH:MM:SS WIB (default).
   *  "compact" = Hari, DD/MM · HH:MM WIB — untuk ruang sempit (mis. top bar POS/Dapur). */
  variant?: "full" | "compact";
  className?: string;
};

/** Jam berjalan Hari/Tanggal/Waktu WIB — dipakai di semua akun (pembeli,
 * kasir, dapur, admin, kiosk absensi). Hanya dirender setelah mount supaya
 * tidak terjadi hydration mismatch antara waktu server & klien. */
export default function DateTimeBadge({ variant = "full", className = "" }: Props) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) {
    // Placeholder netral saat belum mount, biar tidak "lompat" tata letak.
    return <span className={className}>&nbsp;</span>;
  }

  const p = getJakartaParts(now);

  if (variant === "compact") {
    return (
      <span className={className}>
        {p.dayName}, {p.day}/{p.monthNum}/{p.year} · {p.hour}:{p.minute} WIB
      </span>
    );
  }

  return (
    <span className={className}>
      {p.dayName}, {p.day} {p.month} {p.year} · {p.hour}:{p.minute}:{p.second} WIB
    </span>
  );
}
