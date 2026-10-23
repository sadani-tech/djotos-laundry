'use client';
import { AlertTriangle, ChevronLeft, Loader2, Minus, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { rupiah } from '@/lib/format';
import type { OrderStatus, PaymentStatus } from '@/lib/types';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------- Tombol
type Variant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800',
  secondary: 'border border-slate-300 bg-white text-ink hover:border-brand-300 hover:bg-brand-50 active:bg-brand-100',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800',
  success: 'bg-green-600 text-white shadow-sm hover:bg-green-700 active:bg-green-800',
  ghost: 'text-brand-700 hover:bg-brand-50 active:bg-brand-100',
};

export function Button({ variant = 'primary', loading, className, children, disabled, size = 'md', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'min-h-10 px-3 text-sm' : size === 'lg' ? 'min-h-14 px-5 text-lg' : 'min-h-12 px-5 text-base',
        VARIANTS[variant],
        className,
      )}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin" />}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- Badge status (warna konsisten)
export const ORDER_STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  RECEIVED: { label: 'Diterima', cls: 'bg-slate-100 text-slate-700' },
  PROCESSING: { label: 'Diproses', cls: 'bg-yellow-100 text-yellow-800' },
  FINISHED: { label: 'Selesai', cls: 'bg-blue-100 text-blue-800' },
  PICKED_UP: { label: 'Diambil', cls: 'bg-slate-200 text-slate-600' },
  CANCELLED: { label: 'Dibatalkan', cls: 'bg-slate-200 text-slate-500 line-through' },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status];
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold', s.cls)}>{s.label}</span>;
}

/** Hijau LUNAS · merah BELUM BAYAR · merah muda KURANG Rp x (bayar sebagian). */
export function PayBadge({ status, balance, free }: { status: PaymentStatus; balance?: number; free?: boolean }) {
  if (free) return <span className="inline-flex rounded-full bg-accent-100 px-2.5 py-1 text-xs font-bold text-accent-800">FREE</span>;
  if (status === 'PAID') return <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">LUNAS</span>;
  if (status === 'PARTIAL')
    return <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">KURANG {rupiah(balance)}</span>;
  return <span className="inline-flex rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">BELUM BAYAR</span>;
}

export function MethodBadge({ method }: { method: 'CASH' | 'QRIS' }) {
  return (
    <span className={cx('inline-flex rounded-md px-2 py-0.5 text-xs font-bold', method === 'CASH' ? 'bg-emerald-100 text-emerald-800' : 'bg-sky-100 text-sky-800')}>
      {method === 'CASH' ? 'Cash' : 'QRIS'}
    </span>
  );
}

// ---------------------------------------------------------------- Layout kecil
export function PageHeader({ title, back, right, subtitle }: { title: string; back?: string | boolean; right?: ReactNode; subtitle?: string }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 bleed mb-6 flex min-h-16 items-center gap-3 border-b border-line bg-white/95 py-3 backdrop-blur">
      {back && (
        typeof back === 'string' ? (
          <Link href={back} aria-label="Kembali" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100"><ChevronLeft /></Link>
        ) : (
          <button onClick={() => router.back()} aria-label="Kembali" className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100"><ChevronLeft /></button>
        )
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold">{title}</h1>
        {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

export function Spinner({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center text-slate-500">
      {icon && <div className="text-slate-300">{icon}</div>}
      <p className="font-semibold text-slate-700">{title}</p>
      {hint && <p className="max-w-xs text-sm">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorBox({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="card flex flex-col items-center gap-3 border-red-200 bg-red-50 text-center">
      <AlertTriangle className="h-8 w-8 text-red-500" />
      <p className="text-red-700">{error instanceof Error ? error.message : 'Gagal memuat data'}</p>
      {retry && <Button variant="secondary" onClick={retry}>Coba lagi</Button>}
    </div>
  );
}

/** Pilihan satu dari beberapa (tab/chips) berukuran besar. */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={cx('flex gap-1.5 rounded-xl bg-slate-200/70 p-1.5', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx('min-h-10 flex-1 rounded-lg px-3 text-sm font-semibold transition', o.value === value ? 'bg-white text-brand-700 shadow' : 'text-slate-600 hover:text-slate-900')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({ active, children, onClick, tone = 'brand' }: { active?: boolean; children: ReactNode; onClick?: () => void; tone?: 'brand' | 'red' }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition',
        active ? (tone === 'red' ? 'border-red-600 bg-red-600 text-white' : 'border-brand-600 bg-brand-600 text-white') : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
      )}
    >
      {children}
    </button>
  );
}

export function Progress({ value, max, tone }: { value: number; max: number; tone?: 'brand' | 'green' }) {
  const pct = Math.min(100, Math.round((value / Math.max(max, 1)) * 100));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={cx('h-full rounded-full transition-all', tone === 'green' || value >= max ? 'bg-green-500' : 'bg-brand-500')} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------- Stepper angka (−  5  +)
export function Stepper({ value, onChange, step = 1, min = 0, max = 1000, unit }: { value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; unit?: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value).replace('.', ',')), [value]);
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n * 100) / 100)));
  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Kurangi" onClick={() => set(value - step)} className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-200 text-slate-800 active:bg-slate-300"><Minus /></button>
      <div className="relative w-24">
        <input
          inputMode="decimal"
          className="input text-center text-xl font-bold"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value.replace(',', '.'));
            if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          onBlur={() => setText(String(value).replace('.', ','))}
        />
      </div>
      {unit && <span className="text-slate-500">{unit}</span>}
      <button type="button" aria-label="Tambah" onClick={() => set(value + step)} className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white active:bg-brand-700"><Plus /></button>
    </div>
  );
}

// ---------------------------------------------------------------- Sheet / modal
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-10 shadow-pop sm:max-w-md sm:rounded-3xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Tutup" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-slate-100"><X /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Label membungkus input, jadi mengetuk label memfokuskan input dan pembaca layar membacanya dengan benar. */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mb-5 block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-slate-500">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------- Konfirmasi (hapus / batal / tandai lunas)
interface ConfirmOpts { title: string; message?: ReactNode; confirmText?: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

interface Toast { id: number; text: string; tone: 'ok' | 'err' }
const ToastCtx = createContext<{ ok: (t: string) => void; err: (e: unknown) => void }>({ ok: () => {}, err: () => {} });
export const useToast = () => useContext(ToastCtx);

export function UiProvider({ children }: { children: ReactNode }) {
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), []);
  const push = useCallback((text: string, tone: Toast['tone']) => {
    const id = ++seq.current;
    setToasts((t) => [...t.filter((x) => x.text !== text), { id, text, tone }].slice(-2));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'err' ? 6000 : 2500);
  }, []);
  const toast = {
    ok: (t: string) => push(t, 'ok'),
    err: (e: unknown) => push(e instanceof ApiError || e instanceof Error ? e.message : 'Terjadi kesalahan', 'err'),
  };
  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null); };

  return (
    <ConfirmCtx.Provider value={confirm}>
      <ToastCtx.Provider value={toast}>
        {children}
        <Sheet open={!!dlg} onClose={() => close(false)} title={dlg?.title ?? ''}>
          {dlg?.message && <div className="mb-6 text-slate-600">{dlg.message}</div>}
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => close(false)}>Tidak</Button>
            <Button variant={dlg?.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => close(true)}>{dlg?.confirmText ?? 'Ya, lanjut'}</Button>
          </div>
        </Sheet>
        <div className="no-print pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={cx('pointer-events-auto max-w-md rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg', t.tone === 'ok' ? 'bg-green-600' : 'bg-red-600')}>{t.text}</div>
          ))}
        </div>
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  );
}

/** Jalankan aksi async: tampilkan error ramah sebagai toast, kembalikan hasil atau undefined. */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, okMsg?: string): Promise<T | undefined> => {
      setBusy(true);
      try {
        const r = await fn();
        if (okMsg) toast.ok(okMsg);
        return r;
      } catch (e) {
        toast.err(e);
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  return { run, busy };
}
