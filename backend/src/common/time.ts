// Semua laporan memakai WIB (UTC+7, Indonesia tidak mengenal DST).
export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, '0');

/** Tanggal WIB (YYYY-MM-DD) dari sebuah instan waktu. */
export function wibDateStr(d: Date): string {
  const w = new Date(d.getTime() + WIB_OFFSET_MS);
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}`;
}

export const todayStr = () => wibDateStr(new Date());

/** Instan awal hari WIB untuk 'YYYY-MM-DD'. */
export function startOfWibDay(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - WIB_OFFSET_MS);
}

export function isDateStr(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(startOfWibDay(s).getTime());
}

export function isPeriodStr(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}

export type Period = 'day' | 'week' | 'month';

export interface Range {
  start: Date; // inklusif
  end: Date; // eksklusif
  fromStr: string;
  toStr: string; // inklusif
}

/** Rentang hari / minggu (Senin–Minggu) / bulan yang memuat `dateStr`. */
export function periodRange(period: Period, dateStr: string = todayStr()): Range {
  const base = startOfWibDay(dateStr);
  let start = base;
  let end = new Date(base.getTime() + DAY_MS);
  if (period === 'week') {
    const dow = new Date(base.getTime() + WIB_OFFSET_MS).getUTCDay(); // 0=Min
    start = new Date(base.getTime() - ((dow + 6) % 7) * DAY_MS);
    end = new Date(start.getTime() + 7 * DAY_MS);
  } else if (period === 'month') {
    const [y, m] = dateStr.split('-').map(Number);
    start = new Date(Date.UTC(y, m - 1, 1) - WIB_OFFSET_MS);
    end = new Date(Date.UTC(y, m, 1) - WIB_OFFSET_MS);
  }
  return { start, end, fromStr: wibDateStr(start), toStr: wibDateStr(new Date(end.getTime() - 1)) };
}

/** Rentang bulan dari 'YYYY-MM'. */
export function monthRange(ym: string): Range {
  return periodRange('month', `${ym}-01`);
}

export function currentPeriod(): string {
  return todayStr().slice(0, 7);
}

/** Daftar tanggal (YYYY-MM-DD) dalam rentang. */
export function eachDay(r: Range): string[] {
  const out: string[] = [];
  for (let t = r.start.getTime(); t < r.end.getTime(); t += DAY_MS) out.push(wibDateStr(new Date(t)));
  return out;
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const hariName = (dateStr: string) => HARI[new Date(startOfWibDay(dateStr).getTime() + WIB_OFFSET_MS).getUTCDay()];
