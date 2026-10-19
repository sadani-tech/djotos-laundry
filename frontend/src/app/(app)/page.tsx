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
    <div className="pt-4">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-sm text-slate-500">{longDate(today)}</p>
          <h1 className="text-2xl font-extrabold">Halo, {user?.name} 👋</h1>
        </div>
      </div>

      {/* 4 angka utama */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => setFilter('today')} className="card text-left">
          <p className="text-sm font-semibold text-slate-500">Order hari ini</p>
          <p className="mt-1 text-3xl font-extrabold">{d?.ordersToday ?? '–'}</p>
        </button>
        <button onClick={() => setFilter('unpaid')} className="card border-red-200 bg-red-50 text-left">
          <p className="text-sm font-semibold text-red-700">Belum bayar</p>
          <p className="mt-1 text-3xl font-extrabold text-red-700">{d?.unpaid.count ?? '–'}</p>
          <p className="text-sm font-semibold text-red-600">{d ? rupiah(d.unpaid.amount) : ''}</p>
        </button>
        <button onClick={() => setFilter('ready')} className="card border-blue-200 bg-blue-50 text-left">
          <p className="text-sm font-semibold text-blue-700">Siap diambil</p>
          <p className="mt-1 text-3xl font-extrabold text-blue-700">{d?.ready ?? '–'}</p>
        </button>
        <Link href="/cashflow" className="card border-green-200 bg-green-50">
          <p className="text-sm font-semibold text-green-800">{d?.incomeToday.scope === 'mine' ? 'Pemasukan saya hari ini' : 'Pemasukan hari ini'}</p>
          <p className="mt-1 text-2xl font-extrabold text-green-800">{d ? rupiahShort(d.incomeToday.total) : '–'}</p>
          <p className="text-xs font-semibold text-green-700">
            Cash {d ? rupiahShort(d.incomeToday.cash) : '–'} · QRIS {d ? rupiahShort(d.incomeToday.qris) : '–'}
          </p>
        </Link>
      </div>

      <Link href="/order/baru" className="mt-4 block">
        <Button size="lg" className="w-full"><Plus className="h-6 w-6" /> Order Baru</Button>
      </Link>

      {/* Daftar */}
      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
        <input className="input pl-10" placeholder="Cari nama customer atau no. nota" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
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
