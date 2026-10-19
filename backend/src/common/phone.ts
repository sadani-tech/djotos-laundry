/** Normalisasi nomor HP Indonesia ke format 62xxxxxxxxxx. Mengembalikan null jika tidak valid. */
export function normalizePhone(input?: string | null): string | null {
  if (!input) return null;
  let p = input.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '62' + p.slice(1);
  else if (p.startsWith('8')) p = '62' + p;
  if (!/^62\d{8,13}$/.test(p)) return null;
  return p;
}
