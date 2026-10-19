const TZ = 'Asia/Jakarta';

export const rupiah = (n: number | null | undefined) => 'Rp ' + Math.round(n ?? 0).toLocaleString('id-ID');
/** Rp 1,5 jt / Rp 250 rb — untuk ruang sempit. */
export function rupiahShort(n: number) {
  const a = Math.abs(n);
  const s = a >= 1_000_000 ? `${+(a / 1_000_000).toFixed(1)} jt` : a >= 1000 ? `${+(a / 1000).toFixed(1)} rb` : `${a}`;
  return `${n < 0 ? '-' : ''}Rp ${s.replace('.', ',')}`;
}
export const kg = (n: number) => `${+n.toFixed(2)} kg`.replace('.', ',');
export const qtyLabel = (n: number, unit: 'KG' | 'PCS') => (unit === 'KG' ? kg(n) : `${n} pcs`);

export const dateFmt = (iso: string | Date, o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat('id-ID', { timeZone: TZ, ...o }).format(new Date(iso));
export const dateTimeFmt = (iso: string | Date) => dateFmt(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', ':');
export const timeFmt = (iso: string | Date) => dateFmt(iso, { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

/** YYYY-MM-DD menurut WIB. */
export const wibDate = (d: Date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
export const todayStr = () => wibDate();
export const addDays = (dateStr: string, n: number) => {
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return wibDate(d);
};
export const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
export const monthLabel = (ym: string) => dateFmt(`${ym}-15T12:00:00+07:00`, { month: 'long', year: 'numeric' });
export const longDate = (dateStr: string) => dateFmt(`${dateStr}T12:00:00+07:00`, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** Nomor WA untuk wa.me (62...). */
export const waLink = (phone: string, text?: string) => `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
export const phoneShow = (p: string | null) => (p ? (p.startsWith('62') ? '0' + p.slice(2) : p) : '—');
