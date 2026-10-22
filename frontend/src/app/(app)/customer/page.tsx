'use client';
import { ChevronRight, Download, Plus, Search, Users } from 'lucide-react';
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
    <div className="animate-fade-up">
      <PageHeader title="Customer" subtitle="Data dan riwayat pelanggan" right={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => api.download('/customers/export', `rekapan-customer-${todayStr()}.xlsx`))}><Download className="h-4 w-4" /> Excel</Button>
          <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Baru</Button>
        </div>
      } />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
        <input className="input pl-10" type="search" aria-label="Cari customer" placeholder="Cari nama atau nomor WhatsApp" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip active={!unpaid} onClick={() => setUnpaid(false)}>Semua</Chip>
        <Chip active={unpaid} tone="red" onClick={() => setUnpaid(true)}>Belum Bayar</Chip>
        <select className="min-h-10 rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold shadow-sm" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutkan">
          {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
      </div>
      {unpaid && data && data.length > 0 && <p className="mt-3 rounded-xl bg-red-50 p-3 text-center font-semibold text-red-700">Total tagihan belum dibayar: {rupiah(totalUnpaid)}</p>}

      <div className="mt-3 space-y-3">
        {error ? <ErrorBox error={error} retry={() => mutate()} /> : !data ? <Spinner /> : data.length === 0 ? (
          <Empty icon={<Users className="h-12 w-12" />} title={unpaid ? 'Tidak ada tagihan belum bayar 🎉' : 'Belum ada customer'} hint={unpaid ? undefined : 'Tekan tombol + untuk menambah customer.'} />
        ) : data.map((c) => (
          <Link key={c.id} href={`/customer/${c.id}`} className="card block transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg active:bg-slate-50">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-extrabold text-brand-700">{c.name.trim().slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-extrabold tracking-tight">{c.name}</p>
                <p className="text-sm text-slate-500">{phoneShow(c.phone)}</p>
              </div>
              {c.unpaid > 0 && <span className="shrink-0 rounded-xl bg-red-50 px-2.5 py-1 text-right text-[10px] font-bold leading-tight text-red-600">TAGIHAN<span className="block text-xs text-red-700">{rupiah(c.unpaid)}</span></span>}
              {c.unpaid === 0 && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100"><ChevronRight className="h-4 w-4 text-slate-400" /></span>}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-slate-50 p-2 text-sm">
              <div className="px-1"><p className="text-xs text-slate-500">Nota</p><p className="font-bold">{c.orderCount}</p></div>
              <div className="border-x border-slate-200 px-2"><p className="text-xs text-slate-500">Total belanja</p><p className="truncate font-bold">{rupiah(c.totalSpent)}</p></div>
              <div className="px-2"><p className="text-xs text-slate-500">Terakhir</p><p className="font-bold">{c.lastOrderAt ? dateFmt(c.lastOrderAt, { day: 'numeric', month: 'short' }) : '—'}</p></div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Progress value={c.free.count} max={c.free.threshold} />
              <span className={`shrink-0 text-xs font-bold ${c.free.eligible ? 'text-green-700' : 'text-slate-500'}`}>{c.free.eligible ? 'FREE siap!' : `FREE ${c.free.count}/${c.free.threshold}`}</span>
            </div>
          </Link>
        ))}
      </div>

      <NewCustomerSheet open={adding} onClose={() => setAdding(false)} onCreated={() => { setAdding(false); mutate(); }} />
    </div>
  );
}
