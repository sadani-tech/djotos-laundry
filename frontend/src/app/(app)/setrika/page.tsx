'use client';
import { Shirt } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Empty, ErrorBox, PageHeader, Spinner, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { dateTimeFmt, kg } from '@/lib/format';
import { refreshAll, useApi } from '@/lib/swr';
import type { PendingIroning } from '@/lib/types';

function IroningOrder({ order, onDone }: { order: PendingIroning; onDone: (completedOrderId?: number) => void }) {
  const [input, setInput] = useState('');
  const { run, busy } = useAction();
  const amount = Number(input.replace(',', '.'));
  const valid = /^\d+(?:[.,]\d{1,2})?$/.test(input) && amount > 0 && Math.round(amount * 100) <= Math.round(order.remainingKg * 100);
  const save = async () => {
    if (!valid) return;
    const result = await run(() => api.post('/staff/ironing', { orderId: order.orderId, kg: amount }), 'Hasil setrika dicatat');
    if (result) { setInput(''); onDone(Math.round(amount * 100) === Math.round(order.remainingKg * 100) ? order.orderId : undefined); }
  };
  return <div className="card">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><Link href={`/order/${order.orderId}`} className="text-lg font-extrabold hover:text-brand-700">{order.customer.name}</Link><p className="text-sm text-slate-500">{order.invoiceNo} · {dateTimeFmt(order.receivedAt)}</p></div>
      <span className="shrink-0 rounded-full bg-orange-100 px-2.5 py-1 text-sm font-bold text-orange-800">Sisa {kg(order.remainingKg)}</span>
    </div>
    <p className="mt-4 text-sm text-slate-600">Total {kg(order.totalKg)} · sudah disetrika {kg(order.doneKg)}</p>
    <label className="mt-4 block text-sm font-semibold" htmlFor={`iron-${order.orderId}`}>KG yang dikerjakan sekarang</label>
    <div className="mt-2 flex gap-2">
      <input id={`iron-${order.orderId}`} className="input min-w-0 flex-1" type="text" inputMode="decimal" placeholder={`Maks. ${kg(order.remainingKg)}`} value={input} onChange={(e) => setInput(e.target.value)} />
      <Button loading={busy} disabled={!valid} onClick={save}>Catat</Button>
    </div>
    {input && !valid && <p className="mt-2 text-xs text-red-600">Masukkan KG lebih dari 0, maksimal {kg(order.remainingKg)} (2 angka desimal).</p>}
  </div>;
}

export default function IroningPage() {
  const { data, error, mutate } = useApi<PendingIroning[]>('/staff/ironing/pending', { refreshInterval: 30_000 });
  const [completedOrderId, setCompletedOrderId] = useState<number>();
  const reload = (id?: number) => { setCompletedOrderId(id); mutate(); refreshAll(); };
  return <div>
    <PageHeader title="Setrika" back="/" />
    <p className="mb-4 text-sm text-slate-600">Catat hasil setrika per sesi. KG setiap staff tercatat pada nota customer yang sama.</p>
    {completedOrderId && <Link href={`/order/${completedOrderId}`} className="mb-4 block rounded-xl border border-green-200 bg-green-50 p-4 font-semibold text-green-800">Seluruh KG nota ini sudah disetrika. Buka nota untuk tandai Selesai →</Link>}
    {error ? <ErrorBox error={error} retry={() => mutate()} /> : !data ? <Spinner /> : data.length === 0 ? <Empty icon={<Shirt className="h-12 w-12" />} title="Tidak ada setrika yang tersisa" /> : <div className="space-y-3">{data.map((order) => <IroningOrder key={order.orderId} order={order} onDone={reload} />)}</div>}
  </div>;
}
