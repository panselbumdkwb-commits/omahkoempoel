"use client";

import { useState, useTransition } from "react";
import { verifyRegistrationRequestAction, rejectRegistrationRequestAction } from "./actions";

type Request = {
  id: string;
  full_name: string;
  phone: string;
  claimed_position_name: string | null;
  claimed_employee_code: string | null;
  status: string;
  created_at: string;
};
type Candidate = { id: string; employee_code: string; full_name: string };

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Saran username dari nama lengkap (huruf/angka saja, lowercase,
 * dipisah titik) — Admin tetap bebas mengubahnya sebelum submit,
 * cuma titik awal supaya tidak perlu mengetik dari nol. */
function suggestUsername(fullName: string) {
  return fullName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .join(".");
}

export default function VerifikasiClient({
  initialRequests,
  candidates,
}: {
  initialRequests: Request[];
  candidates: Candidate[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [genPassword, setGenPassword] = useState(generatePassword());
  const [isPending, startTransition] = useTransition();

  function verify(fd: FormData) {
    startTransition(async () => {
      try {
        await verifyRegistrationRequestAction(fd);
        const requestId = String(fd.get("requestId"));
        setRequests((prev) => prev.filter((r) => r.id !== requestId));
        setOpenFor(null);
        setMessage(
          `Pendaftaran diverifikasi. PIN kios dibuat. Login Absen Mandiri — Username: ${fd.get(
            "mobileUsername"
          )}, Password: ${fd.get("mobilePassword")} (catat sekarang & teruskan ke pegawai lewat WhatsApp, tidak ditampilkan lagi).`
        );
        setGenPassword(generatePassword());
      } catch (err: any) {
        setMessage(`Gagal: ${err.message}`);
      }
    });
  }

  function reject(id: string) {
    const reason = prompt("Alasan penolakan (opsional):") ?? "";
    startTransition(async () => {
      await rejectRegistrationRequestAction(id, reason);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    });
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">Absensi Mandiri</p>
        <h2 className="font-heading text-2xl sm:text-3xl text-primary">🪪 Verifikasi Pendaftaran Pegawai</h2>
        <p className="text-sm text-text-muted mt-1">
          Pegawai mendaftar sendiri lewat{" "}
          <span className="font-semibold">/pegawai/daftar</span> di HP pribadinya. Tautkan ke data
          pegawai yang sudah ada di menu Pegawai, lalu buatkan PIN kios & login Absen Mandiri
          (username + password sementara) — teruskan username/password ke pegawai lewat WhatsApp;
          pegawai wajib login sekali di{" "}
          <span className="font-semibold">/pegawai/login</span> dan bisa ganti password sendiri
          lewat <span className="font-semibold">/pegawai/akun</span> setelah itu.
        </p>
      </div>

      {message && (
        <div className="rounded-xl bg-surface dark:bg-surface-dark border border-border p-3 text-sm animate-float-in">
          {message}
        </div>
      )}

      {requests.length === 0 ? (
        <p className="text-sm text-text-muted">Tidak ada pendaftaran yang menunggu verifikasi.</p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="card-modern p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.full_name}</p>
                  <p className="text-xs text-text-muted">
                    {r.phone}
                    {r.claimed_position_name && ` · Klaim jabatan: ${r.claimed_position_name}`}
                    {r.claimed_employee_code && ` · Klaim kode: ${r.claimed_employee_code}`}
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => setOpenFor(openFor === r.id ? null : r.id)} className="font-semibold text-accent hover:underline">
                    Verifikasi
                  </button>
                  <button onClick={() => reject(r.id)} className="font-semibold text-danger hover:underline">
                    Tolak
                  </button>
                </div>
              </div>

              {openFor === r.id && (
                <form action={verify} className="mt-3 pt-3 border-t border-border/60 grid grid-cols-2 gap-2">
                  <input type="hidden" name="requestId" value={r.id} />
                  <select name="employeeId" required className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark col-span-2">
                    <option value="">Tautkan ke data pegawai...</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.employee_code} — {c.full_name}
                      </option>
                    ))}
                  </select>
                  {candidates.length === 0 && (
                    <p className="col-span-2 text-xs text-danger">
                      Belum ada pegawai aktif yang belum tertaut. Tambahkan dulu di menu Pegawai.
                    </p>
                  )}
                  <input
                    type="text"
                    inputMode="numeric"
                    name="pin"
                    placeholder="PIN kios (4-8 digit)"
                    required
                    minLength={4}
                    maxLength={8}
                    pattern="\d{4,8}"
                    className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark col-span-2"
                  />
                  <p className="col-span-2 text-xs text-text-muted -mb-1">
                    Login Absen Mandiri (HP pribadi) — terpisah dari PIN kios di atas:
                  </p>
                  <input
                    type="text"
                    name="mobileUsername"
                    placeholder="Username"
                    required
                    minLength={3}
                    maxLength={32}
                    defaultValue={suggestUsername(r.full_name)}
                    className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark col-span-2 sm:col-span-1"
                  />
                  <input
                    type="text"
                    name="mobilePassword"
                    placeholder="Password sementara"
                    required
                    minLength={8}
                    defaultValue={genPassword}
                    className="border border-border rounded-lg p-2 text-sm bg-background dark:bg-background-dark col-span-2 sm:col-span-1"
                  />
                  <button type="submit" disabled={isPending} className="btn-primary-modern col-span-2">
                    Setujui &amp; Buat PIN
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
