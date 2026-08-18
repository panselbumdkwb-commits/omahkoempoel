/**
 * Jabatan (employee_positions.name) di aplikasi ini adalah teks bebas —
 * Admin/Owner bisa menamainya sesuka hati lewat halaman Pegawai. Supaya
 * fitur "Generate Jadwal Otomatis" tetap bisa mengenali jabatan standar
 * cafe (Kasir, Bar, Kitchen, Waitres, Kapten, Sekuriti) walau ejaannya
 * sedikit berbeda, dipakai pencocokan kata kunci (bukan ID tetap) di sini.
 *
 * Kalau Owner memakai nama jabatan yang sama sekali berbeda, generator
 * akan menganggapnya "jabatan lain" dan tidak diikutkan otomatis ke
 * jadwal shift — tetap bisa diatur manual lewat grid jadwal seperti biasa.
 */

export type StandardPosition = "kasir" | "bar" | "kitchen" | "waitress" | "kapten" | "sekuriti" | "other";

const PATTERNS: { key: StandardPosition; regex: RegExp }[] = [
  { key: "kapten", regex: /kapten|captain/i },
  { key: "sekuriti", regex: /sekuriti|security|satpam/i },
  { key: "kasir", regex: /kasir|cashier/i },
  { key: "bar", regex: /\bbar\b|barista|bartender/i },
  { key: "kitchen", regex: /kitchen|dapur|koki|cook/i },
  { key: "waitress", regex: /waitres|waiter|pelayan|server|front serve/i },
];

export function classifyPosition(name: string | null | undefined): StandardPosition {
  if (!name) return "other";
  for (const p of PATTERNS) {
    if (p.regex.test(name)) return p.key;
  }
  return "other";
}
