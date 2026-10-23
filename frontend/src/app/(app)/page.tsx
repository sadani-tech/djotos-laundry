'use client';
import { Banknote, ClipboardList, Clock3, PackageCheck, Plus, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { OrderCard } from '@/components/order';
import { Button, Chip, Empty, ErrorBox, LogoMark, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { longDate, rupiah, rupiahShort, todayStr } from '@/lib/format';
import { useApi } from '@/lib/swr';
import type { Dashboard, Order } from '@/lib/types';

type Filter = 'today' | 'unpaid' | 'process' | 'ready' | 'all';

const FILTERS: { key: Filter; label: string; query: (today: string) => string }[] = [
  { key: 'today', label: 'Hari ini', query: (t) => `date=${t}` },
  { key: 'unpaid', label: 'Belum Bayar', query: () => 'payment=unpaid' },
  { key: 'process', label: 'Diproses', query: () => 'status=RECEIVED,PROCESSING' },
  { key: 'ready', label: 'Siap Diambil', query: () => 'status=FINISHED' },
  { key: 'all', label: 'Semua', query: () => '' },
];

export default function OrderHome() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('today');
  const [q, setQ] = useState('');
  const today = todayStr();

  const dash = useApi<Dashboard>('/dashboard', { refreshInterval: 30_000 });
  const params = [FILTERS.find((f) => f.key === filter)!.query(today), q.trim() ? `q=${encodeURIComponent(q.trim())}` : ''].filter(Boolean).join('&');
  const orders = useApi<Order[]>(`/orders?${params}`, { refreshInterval: 30_000 });
  const d = dash.data;
  const activeLabel = FILTERS.find((f) => f.key === filter)?.label;

  return (
    <div className="animate-fade-up pt-5 sm:pt-7">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-500">{longDate(today)}</p>
            <h1 className="truncate text-2xl font-extrabold tracking-tight text-slate-950">Halo, {user?.name}</h1>
          </div>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 sm:flex"><Sparkles className="h-3.5 w-3.5" /> Siap melayani</span>
      </header>

      {/* 4 angka utama */}
      <section aria-label="Ringkasan hari ini" className="grid grid-cols-2 gap-3">
        <button onClick={() => setFilter('today')} className="card group relative min-h-32 border-brand-600 bg-brand-600 text-left text-white transition hover:-translate-y-0.5 hover:bg-brand-700">
          <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white"><ClipboardList className="h-5 w-5" /></span>
          <p className="text-sm font-semibold text-brand-100">Order hari ini</p>
          <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-white">{d?.ordersToday ?? '–'}</p>
        </button>
        <button onClick={() => setFilter('unpaid')} className="card min-h-32 border-rose-200/80 bg-rose-50 text-left transition hover:-translate-y-0.5 hover:shadow-pop">
          <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700"><Clock3 className="h-5 w-5" /></span>
          <p className="text-sm font-semibold text-rose-700">Belum bayar</p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2"><p className="text-3xl font-extrabold tracking-tight text-rose-700">{d?.unpaid.count ?? '–'}</p><p className="text-xs font-bold text-rose-600">{d ? rupiah(d.unpaid.amount) : ''}</p></div>
        </button>
        <button onClick={() => setFilter('ready')} className="card min-h-32 border-sky-200/80 bg-sky-50 text-left transition hover:-translate-y-0.5 hover:shadow-pop">
          <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-700"><PackageCheck className="h-5 w-5" /></span>
          <p className="text-sm font-semibold text-sky-700">Siap diambil</p>
          <p className="mt-0.5 text-3xl font-extrabold tracking-tight text-sky-800">{d?.ready ?? '–'}</p>
        </button>
        <Link href="/cashflow" className="card min-h-32 border-emerald-200/80 bg-emerald-50 transition hover:-translate-y-0.5 hover:shadow-pop">
          <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Banknote className="h-5 w-5" /></span>
          <p className="text-sm font-semibold text-emerald-700">{d?.incomeToday.scope === 'mine' ? 'Pemasukan saya' : 'Pemasukan hari ini'}</p>
          <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-emerald-800">{d ? rupiahShort(d.incomeToday.total) : '–'}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">
            Cash {d ? rupiahShort(d.incomeToday.cash) : '–'} · QRIS {d ? rupiahShort(d.incomeToday.qris) : '–'}
          </p>
        </Link>
      </section>

      <Link href="/order/baru" className="mt-5 block">
        <Button size="lg" className="w-full rounded-2xl"><Plus className="h-6 w-6" /> Buat Order Baru</Button>
      </Link>

      {/* Daftar */}
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Aktivitas laundry</p>
            <h2 className="section-title mt-0.5">Daftar Order</h2>
          </div>
          {orders.data && <span className="rounded-full bg-slate-200/70 px-2.5 py-1 text-xs font-bold text-slate-600">{orders.data.length} order</span>}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
          <input className="input pl-11" type="search" aria-label="Cari order" placeholder="Cari customer atau nomor nota" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
          {FILTERS.map((f) => (
            <Chip key={f.key} active={filter === f.key} tone={f.key === 'unpaid' ? 'red' : 'brand'} onClick={() => setFilter(f.key)}>{f.label}</Chip>
          ))}
        </div>

        <div className="mt-3 space-y-3">
        {orders.error ? (
          <ErrorBox error={orders.error} retry={() => orders.mutate()} />
        ) : !orders.data ? (
          <Spinner />
        ) : orders.data.length === 0 ? (
          <Empty
            icon={<ClipboardList className="h-12 w-12" />}
            title={filter === 'today' ? 'Belum ada order hari ini' : `Belum ada order ${activeLabel?.toLowerCase()}`}
            hint={filter === 'today' ? 'Tekan "Order Baru" untuk mulai mencatat cucian.' : undefined}
          />
        ) : (
          orders.data.map((o) => <OrderCard key={o.id} order={o} showDate={filter !== 'today'} />)
        )}
        </div>
      </section>
    </div>
  );
}
