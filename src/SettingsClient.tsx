"use client";

import { useState, useTransition } from "react";
import {
  setShowDateTimeClockAction,
  setCafeOperatingHoursAction,
  setEmployeeWorkHoursAction,
  setKedaiProfileAction,
  setBusinessLocationAction,
} from "./actions";
import DateTimeBadge from "@/components/DateTimeBadge";

type KedaiProfile = {
  name: string;
  tagline: string;
  address: string;
  mapsUrl: string;
  instagram: string;
  tiktok: string;
};

export default function SettingsClient({
  role,
  initialShowDateTimeClock,
  initialCafeOperatingHours,
  initialEmployeeWorkHours,
  initialKedaiProfile,
  initialBusinessLocation,
}: {
  role: string | null;
  initialShowDateTimeClock: boolean;
  initialCafeOperatingHours: string;
  initialEmployeeWorkHours: string;
  initialKedaiProfile: KedaiProfile;
  initialBusinessLocation: { latitude: number | null; longitude: number | null };
}) {
  const [showClock, setShowClock] = useState(initialShowDateTimeClock);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canEdit = role === "SUPER_ADMIN";

  const [cafeHours, setCafeHours] = useState(initialCafeOperatingHours);
  const [cafeHoursSaved, setCafeHoursSaved] = useState(initialCafeOperatingHours);
  const [cafeHoursStatus, setCafeHoursStatus] = useState<string | null>(null);

  const [workHours, setWorkHours] = useState(initialEmployeeWorkHours);
  const [workHoursSaved, setWorkHoursSaved] = useState(initialEmployeeWorkHours);
  const [workHoursStatus, setWorkHoursStatus] = useState<string | null>(null);

  const [kedai, setKedai] = useState(initialKedaiProfile);
  const [kedaiSaved, setKedaiSaved] = useState(initialKedaiProfile);
  const [kedaiStatus, setKedaiStatus] = useState<string | null>(null);
  const kedaiDirty = JSON.stringify(kedai) !== JSON.stringify(kedaiSaved);

  const [lat, setLat] = useState(initialBusinessLocation.latitude?.toString() ?? "");
  const [lng, setLng] = useState(initialBusinessLocation.longitude?.toString() ?? "");
  const [locSaved, setLocSaved] = useState({ lat, lng });
  const [locStatus, setLocStatus] = useState<string | null>(null);
  const locDirty = lat !== locSaved.lat || lng !== locSaved.lng;

  function saveKedaiProfile() {
    setKedaiStatus(null);
    startTransition(async () => {
      try {
        await setKedaiProfileAction(kedai);
        setKedaiSaved(kedai);
        setKedaiStatus("Tersimpan.");
      } catch (err: any) {
        setKedaiStatus(err.message ?? "Gagal menyimpan.");
      }
    });
  }

  function saveBusinessLocation() {
    setLocStatus(null);
    startTransition(async () => {
      try {
        const latNum = lat.trim() ? Number(lat) : null;
        const lngNum = lng.trim() ? Number(lng) : null;
        if ((lat.trim() && Number.isNaN(latNum)) || (lng.trim() && Number.isNaN(lngNum))) {
          setLocStatus("Koordinat tidak valid.");
          return;
        }
        await setBusinessLocationAction(latNum, lngNum);
        setLocSaved({ lat, lng });
        setLocStatus("Tersimpan.");
      } catch (err: any) {
        setLocStatus(err.message ?? "Gagal menyimpan.");
      }
    });
  }

  function toggleClock() {
    const next = !showClock;
    setShowClock(next); // optimistik — UI langsung berubah
    setError(null);
    startTransition(async () => {
      try {
        await setShowDateTimeClockAction(next);
      } catch (err: any) {
        setShowClock(!next); // gagal simpan -> kembalikan ke nilai semula
        setError(err.message ?? "Gagal menyimpan pengaturan.");
      }
    });
  }

  function saveCafeHours() {
    setCafeHoursStatus(null);
    startTransition(async () => {
      try {
        await setCafeOperatingHoursAction(cafeHours);
        setCafeHoursSaved(cafeHours);
        setCafeHoursStatus("Tersimpan.");
      } catch (err: any) {
        setCafeHoursStatus(err.message ?? "Gagal menyimpan.");
      }
    });
  }

  function saveWorkHours() {
    setWorkHoursStatus(null);
    startTransition(async () => {
      try {
        await setEmployeeWorkHoursAction(workHours);
        setWorkHoursSaved(workHours);
        setWorkHoursStatus("Tersimpan.");
      } catch (err: any) {
        setWorkHoursStatus(err.message ?? "Gagal menyimpan.");
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="font-heading text-2xl text-primary">Pengaturan</h2>

      {/* Jam Hari/Tanggal/Waktu */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold mb-1">Tampilkan Hari, Tanggal & Waktu (WIB)</p>
            <p className="text-sm text-text-muted">
              Jika aktif, jam berjalan (Hari, Tanggal, Waktu — zona WIB) akan tampil di bagian atas
              semua halaman: menu pembeli, kasir, dapur, admin, dan kiosk absensi.
            </p>
            {!canEdit && (
              <p className="text-xs text-text-muted mt-2">
                Hanya akun Super Admin yang dapat mengubah pengaturan ini.
              </p>
            )}
          </div>
          <button
            onClick={toggleClock}
            disabled={!canEdit || isPending}
            aria-pressed={showClock}
            className={`shrink-0 w-14 h-8 rounded-full transition-colors relative disabled:opacity-50 ${
              showClock ? "bg-success" : "bg-border"
            }`}
          >
            <span
              className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                showClock ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {error && <p className="text-sm text-danger mt-3">{error}</p>}

        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-text-muted mb-2">Pratinjau tampilan:</p>
          <div className="bg-background dark:bg-background-dark rounded-md p-3 text-sm font-jakarta text-text">
            {showClock ? (
              <DateTimeBadge variant="full" />
            ) : (
              <span className="text-text-muted italic">Widget disembunyikan</span>
            )}
          </div>
        </div>
      </section>

      {/* Jam Buka Cafe */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <p className="font-semibold mb-1">Jam Buka Cafe</p>
        <p className="text-sm text-text-muted mb-3">
          Ditampilkan di halaman menu pembeli, di bawah jam berjalan. Bebas format teks, mis. "08:00 –
          22:00 WIB" atau "Setiap hari, 08.00–22.00".
        </p>
        <div className="flex gap-2">
          <input
            value={cafeHours}
            onChange={(e) => setCafeHours(e.target.value)}
            disabled={!canEdit}
            className="flex-1 border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
          />
          <button
            onClick={saveCafeHours}
            disabled={!canEdit || isPending || cafeHours === cafeHoursSaved}
            className="px-4 rounded-md bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            Simpan
          </button>
        </div>
        {cafeHoursStatus && <p className="text-sm text-text-muted mt-2">{cafeHoursStatus}</p>}
        {!canEdit && (
          <p className="text-xs text-text-muted mt-2">Hanya Super Admin yang dapat mengubah ini.</p>
        )}
      </section>

      {/* Jam Kerja Pegawai (kebijakan umum) */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <p className="font-semibold mb-1">Jam Kerja Pegawai</p>
        <p className="text-sm text-text-muted mb-3">
          Kebijakan shift umum (teks bebas) — ditampilkan di halaman Admin dan kiosk absensi sebagai
          panduan. Untuk jadwal harian per pegawai, gunakan menu{" "}
          <span className="font-semibold">Jadwal Kerja</span>.
        </p>
        <div className="flex gap-2">
          <input
            value={workHours}
            onChange={(e) => setWorkHours(e.target.value)}
            disabled={!canEdit}
            className="flex-1 border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
          />
          <button
            onClick={saveWorkHours}
            disabled={!canEdit || isPending || workHours === workHoursSaved}
            className="px-4 rounded-md bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            Simpan
          </button>
        </div>
        {workHoursStatus && <p className="text-sm text-text-muted mt-2">{workHoursStatus}</p>}
        {!canEdit && (
          <p className="text-xs text-text-muted mt-2">Hanya Super Admin yang dapat mengubah ini.</p>
        )}
      </section>

      {/* PROFIL KEDAI — tampil di header & footer halaman menu publik */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <p className="font-semibold mb-1">Profil Kedai</p>
        <p className="text-sm text-text-muted mb-3">
          Nama, tagline, alamat, tautan Maps, dan sosial media — ditampilkan di halaman menu publik
          (header & footer).
        </p>
        <div className="space-y-2">
          <label className="block text-xs text-text-muted">Nama Kedai</label>
          <input
            value={kedai.name}
            onChange={(e) => setKedai({ ...kedai, name: e.target.value })}
            disabled={!canEdit}
            className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
          />
          <label className="block text-xs text-text-muted">Tagline</label>
          <input
            value={kedai.tagline}
            onChange={(e) => setKedai({ ...kedai, tagline: e.target.value })}
            disabled={!canEdit}
            className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
          />
          <label className="block text-xs text-text-muted">Alamat</label>
          <input
            value={kedai.address}
            onChange={(e) => setKedai({ ...kedai, address: e.target.value })}
            disabled={!canEdit}
            className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
          />
          <label className="block text-xs text-text-muted">Tautan Google Maps</label>
          <input
            value={kedai.mapsUrl}
            onChange={(e) => setKedai({ ...kedai, mapsUrl: e.target.value })}
            disabled={!canEdit}
            className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-text-muted">Instagram</label>
              <input
                value={kedai.instagram}
                onChange={(e) => setKedai({ ...kedai, instagram: e.target.value })}
                disabled={!canEdit}
                className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs text-text-muted">TikTok</label>
              <input
                value={kedai.tiktok}
                onChange={(e) => setKedai({ ...kedai, tiktok: e.target.value })}
                disabled={!canEdit}
                className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
              />
            </div>
          </div>
          <button
            onClick={saveKedaiProfile}
            disabled={!canEdit || isPending || !kedaiDirty}
            className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold disabled:opacity-50"
          >
            Simpan Profil Kedai
          </button>
          {kedaiStatus && <p className="text-sm text-text-muted">{kedaiStatus}</p>}
        </div>
        {!canEdit && (
          <p className="text-xs text-text-muted mt-2">Hanya Super Admin yang dapat mengubah ini.</p>
        )}
      </section>

      {/* KOORDINAT LOKASI — dasar validasi radius 10 meter absen masuk lewat HP pribadi */}
      <section className="rounded-md border border-border bg-surface dark:bg-surface-dark p-5">
        <p className="font-semibold mb-1">Koordinat Lokasi Kedai</p>
        <p className="text-sm text-text-muted mb-3">
          Dipakai untuk memvalidasi absen masuk lewat HP pribadi pegawai — pegawai wajib berada dalam
          radius 10 meter dari titik ini. Ambil koordinat dari Google Maps: cari lokasi Kedai, klik-kanan
          titik yang tepat, lalu salin angka lintang/bujur yang muncul.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-text-muted">Latitude</label>
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              disabled={!canEdit}
              placeholder="mis. -7.8724500"
              className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted">Longitude</label>
            <input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              disabled={!canEdit}
              placeholder="mis. 112.5231800"
              className="w-full border border-border rounded-md p-2 bg-background dark:bg-background-dark disabled:opacity-60"
            />
          </div>
        </div>
        <button
          onClick={saveBusinessLocation}
          disabled={!canEdit || isPending || !locDirty}
          className="mt-3 px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold disabled:opacity-50"
        >
          Simpan Koordinat
        </button>
        {locStatus && <p className="text-sm text-text-muted mt-2">{locStatus}</p>}
        {!lat && !lng && (
          <p className="text-xs text-warning mt-2">
            Belum diisi — absen masuk lewat HP pribadi pegawai belum bisa divalidasi sebelum koordinat
            ini diisi.
          </p>
        )}
        {!canEdit && (
          <p className="text-xs text-text-muted mt-2">Hanya Super Admin yang dapat mengubah ini.</p>
        )}
      </section>
    </div>
  );
}
