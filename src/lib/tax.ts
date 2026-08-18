/** Pajak Daerah Restoran (PB1) 10% — SUDAH TERMASUK di harga jual yang
 * tertera di menu (harga tax-inclusive), bukan ditambahkan di atas harga
 * saat checkout. Dipakai untuk memecah nota jadi DPP + Pajak, bukan untuk
 * menambah total tagihan.
 */
export const TAX_RATE = 0.1;

/**
 * Pecah subtotal yang SUDAH termasuk pajak menjadi:
 * - dpp: Dasar Pengenaan Pajak (harga sebelum pajak)
 * - taxAmount: nilai pajak 10% yang terkandung di dalam subtotal
 *
 * Rumus: dpp = subtotal / (1 + TAX_RATE); taxAmount = subtotal - dpp
 */
export function extractInclusiveTax(subtotalInclusiveTax: number): {
  dpp: number;
  taxAmount: number;
} {
  const dpp = subtotalInclusiveTax / (1 + TAX_RATE);
  const taxAmount = subtotalInclusiveTax - dpp;
  return { dpp: Math.round(dpp), taxAmount: Math.round(taxAmount) };
}
