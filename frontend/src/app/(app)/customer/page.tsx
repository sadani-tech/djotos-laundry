'use client';
import { Download, Plus, Search, Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { NewCustomerSheet } from '@/components/customer';
import { Button, Chip, Empty, ErrorBox, PageHeader, Progress, Spinner, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { dateFmt, phoneShow, rupiah, todayStr } from '@/lib/format';
import { useApi } from '@/lib/swr';
import type { Customer } from '@/lib/types';

const SORTS = [
  { v: 'recent', l: 'Terbaru cuci' }, { v: 'name', l: 'Nama A–Z' }, { v: 'spent', l: 'Belanja terbanyak' }, { v: 'unpaid', l: 'Tagihan terbesar' },
];

export default function CustomerPage() {
  const [q, setQ] = useState('');
  const [unpaid, setUnpaid] = useState(false);
  const [sort, setSort] = useState('recent');
  const [adding, setAdding] = useState(false);
  const { run, busy } = useAction();
  const { data, error, mutate } = useApi<Customer[]>(`/customers?sort=${sort}${unpaid ? '&unpaid=1' : ''}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`);
  const totalUnpaid = (data ?? []).reduce((s, c) => s + c.unpaid, 0);

  return (
    <div>
      <PageHeader title="Customer" right={
        <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => api.download('/customers/export', `rekapan-customer-${todayStr()}.xlsx`))}><Download className="h-4 w-4" /> Excel</Button>
      } />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
        <input className="input pl-10" placeholder="Cari nama atau no. WA" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={!unpaid} onClick={() => setUnpaid(false)}>Semua</Chip>
        <Chip active={unpaid} tone="red" onClick={() => setUnpaid(true)}>Belum Bayar</Chip>
        <select className="min-h-10 rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutkan">
          {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
      </div>
      {unpaid && data && data.length > 0 && <p className="mt-3 rounded-xl bg-red-50 p-3 text-center font-semibold text-red-700">Total tagihan belum dibayar: {rupiah(totalUnpaid)}</p>}

      <div className="mt-3 space-y-3">
        {error ? <ErrorBox error={error} retry={() => mutate()} /> : !data ? <Spinner /> : data.length === 0 ? (
          <Empty icon={<Users className="h-12 w-12" />} title={unpaid ? 'Tidak ada tagihan belum bayar 🎉' : 'Belum ada customer'} hint={unpaid ? undefined : 'Tekan tombol + untuk menambah customer.'} />
        ) : data.map((c) => (
          <Link key={c.id} href={`/customer/${c.id}`} className="card block active:bg-slate-50">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-lg font-bold">{c.name}</p>
                <p className="text-sm text-slate-500">{phoneShow(c.phone)}</p>
              </div>
              {c.unpaid > 0 && <span className="shrink-0 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold text-white">BELUM BAYAR {rupiah(c.unpaid)}</span>}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div><p className="text-slate-500">Nota</p><p className="font-bold">{c.orderCount}</p></div>
              <div><p className="text-slate-500">Total belanja</p><p className="font-bold">{rupiah(c.totalSpent)}</p></div>
              <div><p className="text-slate-500">Terakhir</p><p className="font-bold">{c.lastOrderAt ? dateFmt(c.lastOrderAt, { day: 'numeric', month: 'short' }) : '—'}</p></div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Progress value={c.free.count} max={c.free.threshold} />
              <span className={`shrink-0 text-xs font-bold ${c.free.eligible ? 'text-green-700' : 'text-slate-500'}`}>{c.free.eligible ? 'FREE siap!' : `FREE ${c.free.count}/${c.free.threshold}`}</span>
            </div>
          </Link>
        ))}
      </div>

      <button onClick={() => setAdding(true)} aria-label="Tambah customer" className="fixed bottom-24 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg active:bg-brand-700 md:bottom-8"><Plus className="h-7 w-7" /></button>
      <NewCustomerSheet open={adding} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); mutate(); }} />
    </div>
  );
}
