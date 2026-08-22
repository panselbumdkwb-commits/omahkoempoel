import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getJakartaTodayDateString } from "@/lib/timezone";

/**
 * KAS KECIL HARIAN (akun Kasir).
 *
 * Alurnya:
 *  1. SUPER_ADMIN/OWNER "membuka" kas kecil hari ini dengan nominal awal
 *     tertentu (openPettyCashDay) — sesuai permintaan bahwa nominalnya
 *     DITENTUKAN oleh owner/admin, bukan oleh Kasir.
 *  2. Kasir mencatat setiap pemakaian kas kecil selama shift
 *     (recordPettyCashUsage) — mis. beli es batu, plastik, dll.
 *  3. Saldo berjalan = opening_amount - total pemakaian.
 *  4. (Opsional) SUPER_ADMIN/OWNER menutup hari itu di akhir shift
 *     untuk rekonsiliasi (closePettyCashDay).
 *
 * Semua query lewat sesi staf yang login (bukan admin client) supaya
 * RLS (migration 0023) yang membatasi siapa boleh apa tetap berlaku.
 */

export type PettyCashDay = {
  id: string;
  cash_date: string;
  opening_amount: number;
  opening_notes: string | null;
  opened_by: string | null;
  opened_at: string;
  status: "open" | "closed";
  closing_amount: number | null;
  closing_notes: string | null;
  closed_at: string | null;
};

export type PettyCashEntry = {
  id: string;
  description: string;
  amount: number;
  recorded_by: string | null;
  created_at: string;
};

export type PettyCashSummary = {
  day: PettyCashDay | null;
  entries: PettyCashEntry[];
  totalUsed: number;
  balance: number;
};

/** Ambil status Kas Kecil Harian untuk tanggal tertentu (default: hari ini
 * menurut WIB). Kalau belum dibuka Admin/Owner, `day` bernilai null —
 * tampilan Kasir harus menampilkan pesan "belum dibuka" saat ini terjadi. */
export async function getPettyCashSummary(cashDate?: string): Promise<PettyCashSummary> {
  const date = cashDate ?? getJakartaTodayDateString();
  const supabase = createSupabaseServerClient();

  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) return { day: null, entries: [], totalUsed: 0, balance: 0 };

  const { data: day, error: dayError } = await supabase
    .from("petty_cash_days")
    .select(
      "id, cash_date, opening_amount, opening_notes, opened_by, opened_at, status, closing_amount, closing_notes, closed_at"
    )
    .eq("business_id", business.id)
    .eq("cash_date", date)
    .maybeSingle();
  if (dayError) throw new Error(`Gagal memuat Kas Kecil Harian: ${dayError.message}`);
  if (!day) return { day: null, entries: [], totalUsed: 0, balance: 0 };

  const { data: entries, error: entriesError } = await supabase
    .from("petty_cash_entries")
    .select("id, description, amount, recorded_by, created_at")
    .eq("petty_cash_day_id", day.id)
    .order("created_at", { ascending: false });
  if (entriesError) throw new Error(`Gagal memuat pemakaian Kas Kecil: ${entriesError.message}`);

  const totalUsed = (entries ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
  const balance = Number(day.opening_amount) - totalUsed;

  return { day: day as PettyCashDay, entries: (entries ?? []) as PettyCashEntry[], totalUsed, balance };
}

/** Buka Kas Kecil Harian dengan nominal awal — HANYA SUPER_ADMIN/OWNER
 * (dijaga ganda: RLS petty_cash_days_insert di DB + halaman pemanggil). */
export async function openPettyCashDay(input: { cashDate?: string; openingAmount: number; notes?: string }) {
  const date = input.cashDate ?? getJakartaTodayDateString();
  if (!Number.isFinite(input.openingAmount) || input.openingAmount < 0) {
    throw new Error("Nominal awal Kas Kecil tidak valid.");
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: business, error: businessError } = await supabase.from("business").select("id").limit(1).single();
  if (businessError || !business) throw new Error("Konfigurasi bisnis tidak ditemukan.");

  const { error } = await supabase.from("petty_cash_days").insert({
    business_id: business.id,
    cash_date: date,
    opening_amount: input.openingAmount,
    opening_notes: input.notes ?? null,
    opened_by: user?.id ?? null,
  });
  if (error) {
    if (error.code === "23505") throw new Error("Kas Kecil untuk tanggal ini sudah dibuka sebelumnya.");
    throw new Error(`Gagal membuka Kas Kecil Harian (hanya Owner/Admin yang boleh membuka): ${error.message}`);
  }
}

/** Catat 1 pemakaian Kas Kecil Harian — boleh Kasir, Captain, Owner, Admin. */
export async function recordPettyCashUsage(input: { pettyCashDayId: string; description: string; amount: number }) {
  if (!input.description.trim()) throw new Error("Keterangan pemakaian wajib diisi.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Nominal pemakaian tidak valid.");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: business, error: businessError } = await supabase.from("business").select("id").limit(1).single();
  if (businessError || !business) throw new Error("Konfigurasi bisnis tidak ditemukan.");

  const { error } = await supabase.from("petty_cash_entries").insert({
    business_id: business.id,
    petty_cash_day_id: input.pettyCashDayId,
    description: input.description.trim(),
    amount: input.amount,
    recorded_by: user?.id ?? null,
  });
  if (error) throw new Error(`Gagal mencatat pemakaian Kas Kecil: ${error.message}`);
}

/** Tutup Kas Kecil Harian untuk rekonsiliasi akhir shift — HANYA
 * SUPER_ADMIN/OWNER. `closingAmount` idealnya dihitung fisik (uang yang
 * benar-benar tersisa di laci) supaya bisa dibandingkan dengan saldo
 * sistem (opening_amount - totalUsed) untuk mendeteksi selisih. */
export async function closePettyCashDay(input: { pettyCashDayId: string; closingAmount: number; notes?: string }) {
  if (!Number.isFinite(input.closingAmount) || input.closingAmount < 0) {
    throw new Error("Nominal penutupan tidak valid.");
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("petty_cash_days")
    .update({
      status: "closed",
      closing_amount: input.closingAmount,
      closing_notes: input.notes ?? null,
      closed_by: user?.id ?? null,
      closed_at: new Date().toISOString(),
    })
    .eq("id", input.pettyCashDayId);
  if (error) throw new Error(`Gagal menutup Kas Kecil Harian (hanya Owner/Admin yang boleh menutup): ${error.message}`);
}

/** Riwayat Kas Kecil Harian beberapa hari terakhir — untuk halaman
 * ringkasan Owner/Admin (mis. cek pola pemakaian mingguan). */
export async function listRecentPettyCashDays(limit = 14): Promise<PettyCashDay[]> {
  const supabase = createSupabaseServerClient();
  const { data: business } = await supabase.from("business").select("id").limit(1).single();
  if (!business) return [];

  const { data, error } = await supabase
    .from("petty_cash_days")
    .select(
      "id, cash_date, opening_amount, opening_notes, opened_by, opened_at, status, closing_amount, closing_notes, closed_at"
    )
    .eq("business_id", business.id)
    .order("cash_date", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Gagal memuat riwayat Kas Kecil: ${error.message}`);
  return (data ?? []) as PettyCashDay[];
}
