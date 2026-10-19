'use client';
import { Gift, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { EditCustomerSheet } from '@/components/customer';
import { OrderCard } from '@/components/order';
import { Button, ErrorBox, PageHeader, Progress, Spinner, useAction, useConfirm } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateFmt, kg, phoneShow, rupiah, waLink } from '@/lib/format';
import { refreshAll, useApi } from '@/lib/swr';
import type { Customer, Order } from '@/lib/types';

type Detail = Customer & { orders: Order[]; claims: { id: number; claimedAt: string; order: { invoiceNo: string } }[] };

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isOwner } = useAuth();
  const confirm = useConfirm();
  const { run } = useAction();
  const { data: c, error, mutate } = useApi<Detail>(`/customers/${id}`);
  const [editing, setEditing] = useState(false);

  if (error) return <><PageHeader title="Customer" back="/customer" /><ErrorBox error={error} retry={() => mutate()} /></>;
  if (!c) return <><PageHeader title="Customer" back="/customer" /><Spinner /></>;

  const remove = async () => {
    const ok = await confirm({ title: 'Hapus customer ini?', danger: true, confirmText: 'Ya, hapus', message: 'Riwayat nota tetap tersimpan di laporan.' });
    if (ok && (await run(() => api.del(`/customers/${c.id}`), 'Customer dihapus'))) { refreshAll(); router.replace('/customer'); }
  };

  return (
    <div>
      <PageHeader title={c.name} back="/customer" subtitle={phoneShow(c.phone)} right={<button onClick={() => setEditing(true)} aria-label="Ubah" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100"><Pencil className="h-5 w-5" /></button>} />

      <div className="grid grid-cols-2 gap-3">
        <div className="card"><p className="text-sm text-slate-500">Jumlah nota</p><p className="text-2xl font-extrabold">{c.orderCount}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Total belanja</p><p className="text-2xl font-extrabold">{rupiah(c.totalSpent)}</p></div>
        <div className="card"><p className="text-sm text-slate-500">Total cucian</p><p className="text-2xl font-extrabold">{kg(c.totalKg)}</p></div>
        <div className={`card ${c.unpaid > 0 ? 'border-red-300 bg-red-50' : ''}`}>
          <p className={`text-sm ${c.unpaid > 0 ? 'text-red-700' : 'text-slate-500'}`}>Belum dibayar</p>
          <p className={`text-2xl font-extrabold ${c.unpaid > 0 ? 'text-red-700' : ''}`}>{rupiah(c.unpaid)}</p>
        </div>
      </div>

      <div className="card mt-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-2 font-bold"><Gift className="h-5 w-5 text-purple-600" /> Progres FREE</p>
          <p className="font-extrabold">{c.free.count}/{c.free.threshold}</p>
        </div>
        <Progress value={c.free.count} max={c.free.threshold} />
        {c.free.eligible ? (
          <Link href="/free"><Button variant="success" className="mt-3 w-full">Berhak cuci GRATIS — Klaim sekarang</Button></Link>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Kurang {c.free.threshold - c.free.count} nota cuci (lunas) lagi untuk cuci gratis.{c.claims.length > 0 && ` Sudah klaim ${c.claims.length}×.`}</p>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Link href={`/order/baru?customerId=${c.id}`}><Button className="w-full" size="lg"><Plus className="h-5 w-5" /> Order baru</Button></Link>
        {c.phone ? <a href={waLink(c.phone)} target="_blank" rel="noreferrer"><Button variant="secondary" size="lg" className="w-full"><MessageCircle className="h-5 w-5 text-green-600" /> WhatsApp</Button></a> : <Button variant="secondary" size="lg" disabled>Belum ada WA</Button>}
      </div>

      <h2 className="mb-2 mt-6 text-lg font-bold">Riwayat nota ({c.orders.length})</h2>
      <div className="space-y-3">
        {c.orders.length === 0 ? <p className="text-slate-500">Belum ada nota.</p> : c.orders.map((o) => <OrderCard key={o.id} order={o} showDate />)}
      </div>
      {c.lastOrderAt && <p className="mt-4 text-center text-sm text-slate-400">Terakhir cuci: {dateFmt(c.lastOrderAt)}</p>}
      {isOwner && <Button variant="ghost" className="mt-4 w-full text-red-600" onClick={remove}><Trash2 className="h-4 w-4" /> Hapus customer</Button>}

      <EditCustomerSheet open={editing} onClose={() => setEditing(false)} customer={c} onSaved={() => { setEditing(false); mutate(); }} />
    </div>
  );
}
