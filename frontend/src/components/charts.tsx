'use client';
import { rupiah, rupiahShort } from '@/lib/format';

export const CASH_COLOR = '#059669'; // hijau zamrud
export const QRIS_COLOR = '#0284c7'; // biru langit

/** Donat sederhana Cash vs QRIS (SVG, tanpa library). */
export function Donut({ cash, qris, size = 128 }: { cash: number; qris: number; size?: number }) {
  const total = cash + qris;
  const r = 40, c = 2 * Math.PI * r;
  const cashLen = total ? (cash / total) * c : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`Cash ${rupiah(cash)}, QRIS ${rupiah(qris)}`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke={total ? QRIS_COLOR : '#e2e8f0'} strokeWidth="16" />
      {total > 0 && cash > 0 && (
        <circle cx="50" cy="50" r={r} fill="none" stroke={CASH_COLOR} strokeWidth="16" strokeDasharray={`${cashLen} ${c - cashLen}`} transform="rotate(-90 50 50)" />
      )}
      <text x="50" y="47" textAnchor="middle" fontSize="9" fill="#64748b">Total</text>
      <text x="50" y="60" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f172a">{rupiahShort(total)}</text>
    </svg>
  );
}

/** Batang bertumpuk Cash + QRIS per hari. */
export function DailyBars({ data }: { data: { date: string; cash: number; qris: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.cash + d.qris));
  const dense = data.length > 10;
  return (
    <div>
      <div className="flex h-36 items-end gap-1" role="img" aria-label="Pemasukan per hari">
        {data.map((d) => {
          const tot = d.cash + d.qris;
          return (
            <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.date}: Cash ${rupiah(d.cash)}, QRIS ${rupiah(d.qris)}`}>
              <div style={{ height: `${(d.qris / max) * 100}%` }} className="rounded-t bg-sky-600" />
              <div style={{ height: `${(d.cash / max) * 100}%` }} className={`bg-emerald-600 ${d.qris === 0 && tot > 0 ? 'rounded-t' : ''}`} />
              {tot === 0 && <div className="h-0.5 bg-slate-200" />}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1">
        {data.map((d, i) => (
          <span key={d.date} className="min-w-0 flex-1 text-center text-[10px] text-slate-500">{!dense || i % 5 === 0 || i === data.length - 1 ? d.date.slice(8) : ''}</span>
        ))}
      </div>
    </div>
  );
}
