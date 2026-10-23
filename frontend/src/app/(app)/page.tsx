'use client';
import { ClipboardList, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { OrderCard } from '@/components/order';
import { Button, Chip, Empty, ErrorBox, Spinner } from '@/components/ui';
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

  return (
    <div className="pt-8">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <p className="text-sm text-slate-500">{longDate(today)}</p>
          <h1 className="text-2xl font-extrabold">Halo, {user?.name} 👋</h1>
        </div>
      </div>

      {/* 4 angka utama */}
      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => setFilter('today')} className="card flex min-h-32 flex-col justify-between border-brand-600 bg-brand-600 text-left text-white shadow-sm">
          <p className="text-sm font-semibold text-brand-100">Order hari ini</p>
          <p className="text-4xl font-extrabold leading-none">{d?.ordersToday ?? '–'}</p>
        </button>
        <button onClick={() => setFilter('unpaid')} className="card flex min-h-32 flex-col justify-between border-red-200 bg-red-50 text-left">
          <p className="text-sm font-semibold text-red-700">Belum bayar</p>
          <div>
            <p className="text-4xl font-extrabold leading-none text-red-700">{d?.unpaid.count ?? '–'}</p>
            <p className="mt-1.5 text-sm font-semibold text-red-600">{d ? rupiah(d.unpaid.amount) : ''}</p>
          </div>
        </button>
        <button onClick={() => setFilter('ready')} className="card flex min-h-32 flex-col justify-between border-blue-200 bg-blue-50 text-left">
          <p className="text-sm font-semibold text-blue-700">Siap diambil</p>
          <p className="text-4xl font-extrabold leading-none text-blue-700">{d?.ready ?? '–'}</p>
        </button>
        <Link href="/cashflow" className="card flex min-h-32 flex-col justify-between border-green-200 bg-green-50">
          <p className="text-sm font-semibold text-green-800">{d?.incomeToday.scope === 'mine' ? 'Pemasukan saya' : 'Pemasukan'}</p>
          <div>
            <p className="text-3xl font-extrabold leading-none text-green-800">{d ? rupiahShort(d.incomeToday.total) : '–'}</p>
            <p className="mt-2 flex justify-between gap-2 text-xs font-semibold text-green-700"><span>Cash {d ? rupiahShort(d.incomeToday.cash) : '–'}</span><span>QRIS {d ? rupiahShort(d.incomeToday.qris) : '–'}</span></p>
          </div>
        </Link>
      </div>

      <Link href="/order/baru" className="mt-5 block">
        <Button size="lg" className="w-full"><Plus className="h-6 w-6" /> Order Baru</Button>
      </Link>

      {/* Daftar */}
      <div className="relative mt-6">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
        <input className="input pl-10" placeholder="Cari nama customer atau no. nota" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="bleed mt-4 flex gap-2 overflow-x-auto  pb-1">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} tone={f.key === 'unpaid' ? 'red' : 'brand'} onClick={() => setFilter(f.key)}>{f.label}</Chip>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        {orders.error ? (
          <ErrorBox error={orders.error} retry={() => orders.mutate()} />
        ) : !orders.data ? (
          <Spinner />
        ) : orders.data.length === 0 ? (
          <Empty
            icon={<ClipboardList className="h-12 w-12" />}
            title={filter === 'today' ? 'Belum ada order hari ini' : 'Tidak ada order di sini'}
            hint={filter === 'today' ? 'Tekan "Order Baru" untuk mulai mencatat cucian.' : undefined}
          />
        ) : (
          orders.data.map((o) => <OrderCard key={o.id} order={o} showDate={filter !== 'today'} />)
        )}
      </div>
    </div>
  );
}
