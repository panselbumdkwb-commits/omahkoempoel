/** Asia/Jakarta = UTC+7 tetap sepanjang tahun (tidak ada DST), sesuai
 * Master Prompt Bagian 74 poin 24: timezone harus konsisten. */
const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export function getJakartaTodayRange(): { startUTC: Date; endUTC: Date } {
  const now = new Date();
  const jakartaShifted = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const y = jakartaShifted.getUTCFullYear();
  const m = jakartaShifted.getUTCMonth();
  const d = jakartaShifted.getUTCDate();

  const startUTC = new Date(Date.UTC(y, m, d, 0, 0, 0) - JAKARTA_OFFSET_MS);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);
  return { startUTC, endUTC };
}
