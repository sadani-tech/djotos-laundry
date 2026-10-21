'use client';
import { Ban, MessageCircle, Pencil, Printer, RotateCw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AdvanceButton } from '@/components/order';
import { Button, ErrorBox, Field, MethodBadge, PageHeader, PayBadge, Segmented, Sheet, Spinner, StatusBadge, useAction, useConfirm } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTimeFmt, phoneShow, qtyLabel, rupiah, waLink } from '@/lib/format';
import { refreshAll, useApi } from '@/lib/swr';
import type { Order, OrderStatus, PayMethod } from '@/lib/types';

const STEPS: { s: OrderStatus; label: string; at: (o: Order) => string | null }[] = [
  { s: 'RECEIVED', label: 'Diterima', at: (o) => o.receivedAt },
  { s: 'PROCESSING', label: 'Diproses', at: () => null },
  { s: 'FINISHED', label: 'Selesai', at: (o) => o.finishedAt },
  { s: 'PICKED_UP', label: 'Diambil', at: (o) => o.pickedUpAt },
];
const ORDER_IDX: Record<OrderStatus, number> = { RECEIVED: 0, PROCESSING: 1, FINISHED: 2, PICKED_UP: 3, CANCELLED: -1 };

function Detail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = useSearchParams().get('baru') === '1';
  const { isOwner } = useAuth();
  const confirm = useConfirm();
  const { run, busy } = useAction();
  const { data: o, error, mutate } = useApi<Order>(`/orders/${id}`);
  const [payOpen, setPayOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [discOpen, setDiscOpen] = useState(false);

  if (error) return <><PageHeader title="Nota" back="/" /><ErrorBox error={error} retry={() => mutate()} /></>;
  if (!o) return <><PageHeader title="Nota" back="/" /><Spinner /></>;

  const reload = () => { mutate(); refreshAll(); };
  const cancelled = o.status === 'CANCELLED';
  const idx = ORDER_IDX[o.status];

  const payFull = async (method: PayMethod) => {
    const ok = await confirm({
      title: 'Tandai lunas?',
      confirmText: 'Ya, sudah dibayar',
      message: <p>Terima pembayaran <b>{rupiah(o.balance)}</b> lewat <b>{method === 'CASH' ? 'Cash' : 'QRIS'}</b> untuk nota {o.invoiceNo}?</p>,
    });
    if (ok && (await run(() => api.post(`/orders/${o.id}/pay-full`, { method }), 'Pembayaran dicatat'))) reload();
  };
  const voidPay = async (pid: number, amount: number) => {
    const ok = await confirm({ title: 'Batalkan pembayaran ini?', danger: true, confirmText: 'Ya, batalkan', message: `Pembayaran ${rupiah(amount)} akan dihapus dari cashflow dan nota kembali kurang bayar.` });
    if (ok && (await run(() => api.del(`/payments/${pid}`), 'Pembayaran dibatalkan'))) reload();
  };
  const cancel = async () => {
    setMenuOpen(false);
    const ok = await confirm({
      title: 'Batalkan nota ini?', danger: true, confirmText: 'Ya, batalkan nota',
      message: o.paidAmount > 0 ? `Nota sudah dibayar ${rupiah(o.paidAmount)}. Pembayaran akan dibatalkan juga (uang dikembalikan ke customer).` : 'Nota yang dibatalkan tidak dihitung di laporan.',
    });
    if (ok && (await run(() => api.post(`/orders/${o.id}/cancel`, {}), 'Nota dibatalkan'))) reload();
  };
  const remove = async () => {
    setMenuOpen(false);
    const ok = await confirm({ title: 'Hapus nota ini?', danger: true, confirmText: 'Ya, hapus', message: 'Nota akan hilang dari daftar. Riwayat perubahan tetap tersimpan di log.' });
    if (ok && (await run(() => api.del(`/orders/${o.id}`), 'Nota dihapus'))) { refreshAll(); router.replace('/'); }
  };
  const resend = async (logId: number) => {
    if (await run(() => api.post(`/wa/logs/${logId}/resend`), 'Pesan WA dikirim ulang')) setTimeout(reload, 1500);
  };
  const lastWa = o.waLogs?.[0];
  const waText = `Halo kak ${o.customer.name}, nota ${o.invoiceNo} total ${rupiah(o.total)} (${o.paymentStatus === 'PAID' ? 'lunas' : 'belum lunas, sisa ' + rupiah(o.balance)}).`;

  return (
    <div>
      <PageHeader title={o.invoiceNo} back="/" subtitle={dateTimeFmt(o.receivedAt) + ' · ' + o.staff.name} right={
        <button onClick={() => setMenuOpen(true)} aria-label="Menu lainnya" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100 text-lg font-bold">⋯</button>
      } />

      {isNew && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-green-300 bg-green-50 p-4">
          <span className="text-2xl">✅</span>
          <p className="flex-1 font-semibold text-green-800">Nota berhasil dibuat</p>
          <Link href={`/nota/${o.id}`}><Button size="sm" variant="success"><Printer className="h-4 w-4" /> Cetak</Button></Link>
        </div>
      )}

      {/* Customer + badge */}
      <div className="card mb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/customer/${o.customer.id}`} className="block truncate text-xl font-extrabold hover:underline">{o.customer.name}</Link>
            <p className="text-slate-500">{phoneShow(o.customer.phone)}</p>
          </div>
          {o.customer.phone && (
            <a href={waLink(o.customer.phone, waText)} target="_blank" rel="noreferrer" aria-label="Chat WhatsApp" className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-700"><MessageCircle /></a>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <StatusBadge status={o.status} />
          {!cancelled && <PayBadge status={o.paymentStatus} balance={o.balance} free={o.isFree && o.total === 0} />}
          {o.isFree && <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-800">Nota FREE</span>}
        </div>
      </div>

      {/* Progres status */}
      {!cancelled && (
        <div className="card mb-4">
          <ol className="flex items-start justify-between">
            {STEPS.map((st, i) => (
              <li key={st.s} className="flex flex-1 flex-col items-center text-center">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${i <= idx ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'}`}>{i < idx ? '✓' : i + 1}</span>
                <span className={`mt-1 text-xs font-semibold ${i === idx ? 'text-brand-700' : 'text-slate-500'}`}>{st.label}</span>
                <span className="text-[10px] text-slate-400">{i <= idx && st.at(o) ? dateTimeFmt(st.at(o)!) : ''}</span>
              </li>
            ))}
          </ol>
          {o.estimatedAt && idx < 2 && <p className="mt-4 text-center text-sm text-slate-500">Estimasi selesai: <b>{dateTimeFmt(o.estimatedAt)}</b></p>}
          <AdvanceButton order={o} size="lg" onDone={reload} className="mt-4 w-full" />
        </div>
      )}

      {/* Rincian */}
      <div className="card mb-4">
        <h2 className="mb-2 font-bold">Rincian</h2>
        <ul className="divide-y divide-slate-100">
          {o.items.map((i) => (
            <li key={i.id} className="flex items-center justify-between gap-3 py-3">
              <div><p className="font-semibold">{i.code} <span className="font-normal text-slate-500">· {i.name}</span></p><p className="text-sm text-slate-500">{qtyLabel(i.qty, i.unit)} × {rupiah(i.unitPrice)}</p></div>
              <p className="whitespace-nowrap font-bold">{rupiah(i.subtotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-2 border-t border-slate-200 pt-2 text-right">
          {o.discount > 0 && <div className="flex justify-between text-slate-600"><dt>Diskon</dt><dd>− {rupiah(o.discount)}</dd></div>}
          <div className="flex justify-between text-lg font-extrabold"><dt>Total</dt><dd>{rupiah(o.total)}</dd></div>
          <div className="flex justify-between text-slate-600"><dt>Sudah dibayar</dt><dd>{rupiah(o.paidAmount)}</dd></div>
          {!cancelled && o.balance > 0 && <div className="flex justify-between text-lg font-extrabold text-red-600"><dt>Sisa tagihan</dt><dd>{rupiah(o.balance)}</dd></div>}
        </dl>
        {o.note && <p className="mt-4 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">📝 {o.note}</p>}
      </div>

      {/* Pembayaran */}
      {!cancelled && (
        <div className="card mb-4">
          <h2 className="mb-2 font-bold">Pembayaran</h2>
          {o.payments.length === 0 ? <p className="mb-4 text-slate-500">Belum ada pembayaran.</p> : (
            <ul className="mb-4 divide-y divide-slate-100">
              {o.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-3">
                  <div className="flex items-center gap-2"><MethodBadge method={p.method} /><span className="text-sm text-slate-500">{dateTimeFmt(p.paidAt)} · {p.receivedBy.name}</span></div>
                  <div className="flex items-center gap-1">
                    <b>{rupiah(p.amount)}</b>
                    {isOwner && <button onClick={() => voidPay(p.id, p.amount)} aria-label="Batalkan pembayaran" className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {o.balance > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Button variant="success" size="lg" loading={busy} onClick={() => payFull('CASH')}>Lunas Cash</Button>
                <Button size="lg" loading={busy} className="bg-sky-600 hover:bg-sky-700" onClick={() => payFull('QRIS')}>Lunas QRIS</Button>
              </div>
              <Button variant="secondary" className="w-full" onClick={() => setPayOpen(true)}>Bayar sebagian…</Button>
            </div>
          )}
        </div>
      )}

      {/* WhatsApp */}
      {lastWa && (
        <div className="card mb-4">
          <h2 className="mb-1 font-bold">Pesan WhatsApp</h2>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm">
              {lastWa.status === 'SENT' && <span className="font-semibold text-green-700">✓ Terkirim · {dateTimeFmt(lastWa.sentAt ?? lastWa.createdAt)}</span>}
              {lastWa.status === 'QUEUED' && <span className="font-semibold text-amber-700">⏳ Menunggu dikirim…{lastWa.error ? ` (percobaan ${lastWa.attempts}: ${lastWa.error})` : ''}</span>}
              {lastWa.status === 'FAILED' && <span className="font-semibold text-red-600">✕ Gagal: {lastWa.error}</span>}
            </p>
            {lastWa.status === 'FAILED' && o.customer.phone && <Button size="sm" variant="secondary" onClick={() => resend(lastWa.id)}><RotateCw className="h-4 w-4" /> Kirim ulang</Button>}
          </div>
        </div>
      )}

      <Link href={`/nota/${o.id}`}><Button variant="secondary" size="lg" className="w-full"><Printer className="h-5 w-5" /> Cetak / Bagikan Nota</Button></Link>

      <PaySheet open={payOpen} onClose={() => setPayOpen(false)} order={o} onDone={() => { setPayOpen(false); reload(); }} />
      <DiscountSheet open={discOpen} onClose={() => setDiscOpen(false)} order={o} onDone={() => { setDiscOpen(false); reload(); }} />
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Lainnya">
        <div className="space-y-3">
          {!cancelled && !o.isFree && <Button variant="secondary" className="w-full justify-start" onClick={() => { setMenuOpen(false); setDiscOpen(true); }}><Pencil className="h-5 w-5" /> Diskon / catatan</Button>}
          {!cancelled && !o.isFree && <Button variant="secondary" className="w-full justify-start text-red-600" onClick={cancel}><Ban className="h-5 w-5" /> Batalkan nota</Button>}
          {isOwner && !o.isFree && <Button variant="secondary" className="w-full justify-start text-red-600" onClick={remove}><Trash2 className="h-5 w-5" /> Hapus nota (Owner)</Button>}
          {o.isFree && <p className="text-sm text-slate-500">Nota FREE tidak bisa diubah atau dibatalkan.</p>}
        </div>
      </Sheet>
    </div>
  );
}

function PaySheet({ open, onClose, order, onDone }: { open: boolean; onClose: () => void; order: Order; onDone: () => void }) {
  const { run, busy } = useAction();
  const [method, setMethod] = useState<PayMethod>('CASH');
  const [amount, setAmount] = useState('');
  const n = parseInt(amount.replace(/\D/g, '') || '0', 10);
  const save = async () => {
    if (await run(() => api.post(`/orders/${order.id}/payments`, { method, amount: n }), 'Pembayaran dicatat')) { setAmount(''); onDone(); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Bayar sebagian">
      <p className="mb-4 text-slate-600">Sisa tagihan: <b className="text-red-600">{rupiah(order.balance)}</b></p>
      <Segmented<PayMethod> className="mb-5" value={method} onChange={setMethod} options={[{ value: 'CASH', label: 'Cash' }, { value: 'QRIS', label: 'QRIS' }]} />
      <Field label="Nominal (Rp)">
        <input className="input text-xl font-bold" inputMode="numeric" value={n ? n.toLocaleString('id-ID') : ''} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
      </Field>
      <div className="mb-5 flex gap-2">
        {[0.5, 1].map((f) => <button key={f} onClick={() => setAmount(String(Math.round(order.balance * f)))} className="rounded-full border border-slate-300 px-4 py-3 text-sm font-semibold">{f === 1 ? 'Semua sisa' : 'Setengah'}</button>)}
      </div>
      <Button size="lg" className="w-full" loading={busy} disabled={n < 1 || n > order.balance} onClick={save}>Catat Pembayaran</Button>
    </Sheet>
  );
}

function DiscountSheet({ open, onClose, order, onDone }: { open: boolean; onClose: () => void; order: Order; onDone: () => void }) {
  const { run, busy } = useAction();
  const [discount, setDiscount] = useState(String(order.discount));
  const [note, setNote] = useState(order.note ?? '');
  const d = parseInt(discount.replace(/\D/g, '') || '0', 10);
  const save = async () => {
    if (await run(() => api.patch(`/orders/${order.id}`, { discount: d, note }), 'Nota diperbarui')) onDone();
  };
  return (
    <Sheet open={open} onClose={onClose} title="Diskon / catatan">
      <Field label="Diskon (Rp)" hint={`Subtotal ${rupiah(order.subtotal)}`}><input className="input" inputMode="numeric" value={d ? d.toLocaleString('id-ID') : ''} onChange={(e) => setDiscount(e.target.value)} placeholder="0" /></Field>
      <Field label="Catatan"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <Button size="lg" className="w-full" loading={busy} onClick={save}>Simpan</Button>
    </Sheet>
  );
}

export default function Page() {
  return <Suspense fallback={<Spinner />}><Detail /></Suspense>;
}
