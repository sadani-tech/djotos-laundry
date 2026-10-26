'use client';
import { ArrowLeft, MessageCircle, Printer, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Button, ErrorBox, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { dateFmt, phoneShow, qtyLabel, rupiah, waLink } from '@/lib/format';
import { useApi } from '@/lib/swr';
import type { Order, Settings } from '@/lib/types';

/** Nota siap cetak thermal 58 mm (lebar kertas ±48 mm). Di layar tampil sebagai pratinjau. */
export default function NotaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  useEffect(() => { if (!loading && !user) router.replace('/login'); }, [loading, user, router]);
  const { data: o, error } = useApi<Order>(user ? `/orders/${id}` : null);
  const { data: s } = useApi<Settings>(user ? '/settings' : null);

  if (error) return <div className="p-4"><ErrorBox error={error} /></div>;
  if (!o || !s) return <Spinner />;

  const text = [
    `*${s.shop.name}*`,
    `Nota: ${o.invoiceNo}`,
    `Tgl: ${dateFmt(o.receivedAt, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    `Customer: ${o.customer.name}`,
    ...o.items.map((i) => `${i.code} ${qtyLabel(i.qty, i.unit)} = ${rupiah(i.subtotal)}`),
    `Total: ${rupiah(o.total)}`,
    o.paymentStatus === 'PAID' ? 'Status: LUNAS' : `Status: BELUM LUNAS (sisa ${rupiah(o.balance)})`,
    s.shop.footer,
  ].join('\n');

  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: o.invoiceNo, text }); return; } catch { /* dibatalkan */ } }
    await navigator.clipboard?.writeText(text);
    alert('Teks nota disalin. Tempel di WhatsApp.');
  };
  const line = <hr className="my-2 border-dashed border-slate-400" />;

  return (
    <div className="min-h-screen bg-slate-100 p-4 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-5 flex max-w-sm items-center gap-2">
        <Link href={`/order/${o.id}`} aria-label="Kembali" className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow"><ArrowLeft /></Link>
        <Button className="flex-1" size="lg" onClick={() => window.print()}><Printer className="h-5 w-5" /> Cetak</Button>
        <Button variant="secondary" size="lg" onClick={share} aria-label="Bagikan"><Share2 className="h-5 w-5" /></Button>
        {o.customer.phone && <a href={waLink(o.customer.phone, text)} target="_blank" rel="noreferrer" aria-label="Kirim lewat WhatsApp" className="flex h-14 w-14 items-center justify-center rounded-xl bg-green-600 text-white"><MessageCircle /></a>}
      </div>

      <article className="mx-auto w-[58mm] max-w-full bg-white p-2 font-mono text-[11px] leading-snug text-black shadow print:w-full print:shadow-none" style={{ width: '58mm' }}>
        <header className="text-center">
          <p className="text-sm font-bold uppercase">{s.shop.name}</p>
          {s.shop.address && <p>{s.shop.address}</p>}
          {s.shop.phone && <p>Telp/WA: {s.shop.phone}</p>}
        </header>
        {line}
        <p>No : {o.invoiceNo}</p>
        <p>Tgl: {dateFmt(o.receivedAt, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
        <p>Cust: {o.customer.name}{o.customer.phone ? ` (${phoneShow(o.customer.phone)})` : ''}</p>
        <p>Kasir: {o.staff.name}</p>
        {line}
        {o.items.map((i) => (
          <div key={i.id} className="mb-1">
            <p className="font-bold">{i.code} — {i.name}</p>
            <p className="flex justify-between"><span>{qtyLabel(i.qty, i.unit)} × {i.unitPrice.toLocaleString('id-ID')}</span><span>{i.subtotal.toLocaleString('id-ID')}</span></p>
          </div>
        ))}
        {line}
        {o.discount > 0 && <p className="flex justify-between"><span>{o.isFree ? 'Potongan FREE' : 'Diskon'}</span><span>-{o.discount.toLocaleString('id-ID')}</span></p>}
        <p className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{rupiah(o.total)}</span></p>
        <p className="flex justify-between"><span>Dibayar</span><span>{rupiah(o.paidAmount)}</span></p>
        {o.balance > 0 && <p className="flex justify-between font-bold"><span>SISA</span><span>{rupiah(o.balance)}</span></p>}
        <p className="mt-1 text-center text-sm font-bold">{o.isFree && o.total === 0 ? '★ FREE ★' : o.paymentStatus === 'PAID' ? '*** LUNAS ***' : '*** BELUM LUNAS ***'}</p>
        {o.note && <p className="mt-1">Cat: {o.note}</p>}
        {line}
        <p className="text-center">{s.shop.footer}</p>
      </article>
    </div>
  );
}
