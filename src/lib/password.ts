import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

/** Hash password login mobile pegawai dengan scrypt (built-in Node,
 * tanpa dependency tambahan) + salt unik per pegawai. Pola sama persis
 * dengan src/lib/pin.ts (attendance_pin_hash), file terpisah supaya
 * penamaan tetap jelas: pin.ts untuk PIN kios, password.ts untuk
 * password login Absen Mandiri (HP pribadi). Format simpan: "salt:hash". */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
