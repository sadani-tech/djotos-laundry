'use client';
import { Gift, PartyPopper } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Empty, ErrorBox, PageHeader, Progress, Sheet, Spinner, Stepper, useAction, useConfirm } from '@/components/ui';
import { api } from '@/lib/api';
import { dateFmt, kg, rupiah } from '@/lib/format';
import { linePrice } from '@/lib/pricing';
import { refreshAll, useApi } from '@/lib/swr';
import type { FreeOverview, FreeRow, Order, Service } from '@/lib/types';

interface Claim { id: number; claimedAt: string; customer: { id: number; name: string }; claimedBy: { name: string }; order: { id: number; invoiceNo: string; total: number } }

export default function FreePage() {
  const { data, error, mutate } = useApi<FreeOverview>('/free');
  const claims = useApi<Claim[]>('/free/claims');
  const [target, setTarget] = useState<FreeRow | null>(null);

  return (
    <div>
      <PageHeader title="FREE" />
      <div className="card border-accent-200 bg-accent-50">
        <p className="flex items-center gap-2 font-bold text-accent-800"><Gift className="h-5 w-5" /> Kumpulkan {data?.threshold ?? 9} nota cuci → 1× cuci GRATIS</p>
        <p className="mt-1 text-sm text-accent-900">Yang dihitung: nota cuci yang sudah <b>lunas</b> dan tidak dibatalkan. Gratis sampai {data ? kg(data.freeKg) : '3 kg'}; kelebihan berat dibayar biasa.</p>
      </div>

      {error ? <div className="mt-5"><ErrorBox error={error} retry={() => mutate()} /></div> : !data ? <Spinner /> : (
        <>
          <h2 className="mb-2 mt-6 flex items-center gap-2 text-lg font-bold"><PartyPopper className="h-5 w-5 text-accent-700" /> Siap klaim ({data.ready.length})</h2>
          {data.ready.length === 0 ? <p className="rounded-xl bg-white p-4 text-center text-slate-500">Belum ada customer yang berhak klaim.</p> : (
            <div className="space-y-4">
              {data.ready.map((c) => (
                <div key={c.id} className="card border-green-300 bg-green-50">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0"><Link href={`/customer/${c.id}`} className="block truncate text-lg font-bold hover:underline">{c.name}</Link><p className="text-sm font-semibold text-green-700">{c.count}/{c.threshold} nota{c.count > c.threshold ? ` (sisa ${c.count - c.threshold} setelah klaim)` : ''}</p></div>
                    <Button variant="success" onClick={() => setTarget(c)}>Klaim FREE</Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h2 className="mb-2 mt-6 text-lg font-bold">Progres customer</h2>
          {data.progress.length === 0 ? <Empty title="Belum ada progres" hint="Progres muncul setelah customer punya nota cuci yang lunas." /> : (
            <div className="space-y-3">
              {data.progress.map((c) => (
                <Link key={c.id} href={`/customer/${c.id}`} className="card flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex justify-between"><span className="truncate font-bold">{c.name}</span><span className="font-extrabold">{c.count}/{c.threshold}</span></div>
                    <Progress value={c.count} max={c.threshold} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <h2 className="mb-2 mt-6 text-lg font-bold">Riwayat klaim</h2>
      {!claims.data ? <Spinner /> : claims.data.length === 0 ? <p className="text-slate-500">Belum ada klaim.</p> : (
        <ul className="space-y-3">
          {claims.data.map((c) => (
            <li key={c.id}><Link href={`/order/${c.order.id}`} className="card flex items-center justify-between p-4"><span><b>{c.customer.name}</b><span className="block text-sm text-slate-500">{c.order.invoiceNo} · {dateFmt(c.claimedAt)} · {c.claimedBy.name}</span></span><span className="rounded-full bg-accent-100 px-2.5 py-1 text-xs font-bold text-accent-800">{c.order.total === 0 ? 'FREE' : rupiah(c.order.total)}</span></Link></li>
          ))}
        </ul>
      )}

      {target && data && <ClaimSheet row={target} freeKg={data.freeKg} onClose={() => setTarget(null)} onDone={(o) => { setTarget(null); mutate(); claims.mutate(); refreshAll(); window.location.assign(`/order/${o.id}?baru=1`); }} />}
    </div>
  );
}

function ClaimSheet({ row, freeKg, onClose, onDone }: { row: FreeRow; freeKg: number; onClose: () => void; onDone: (o: Order) => void }) {
  const services = useApi<Service[]>('/services');
  const confirm = useConfirm();
  const { run, busy } = useAction();
  const kgServices = (services.data ?? []).filter((s) => s.unit === 'KG' && s.countsForFree);
  const [serviceId, setServiceId] = useState<number | null>(null);
  const [qty, setQty] = useState(freeKg);
  const svc = kgServices.find((s) => s.id === (serviceId ?? kgServices[0]?.id));

  const price = svc ? linePrice(svc, qty) : null;
  const discount = svc && price ? (price.billedQty <= freeKg ? price.subtotal : Math.min(price.subtotal, Math.round(freeKg * svc.rate))) : 0;
  const pay = price ? price.subtotal - discount : 0;

  const claim = async () => {
    if (!svc) return;
    const ok = await confirm({ title: `Klaim FREE untuk ${row.name}?`, confirmText: 'Ya, klaim', message: `${row.threshold} nota akan dipakai dan progres kembali ke 0. Nota FREE ${svc.code} ${kg(qty)} dibuat${pay > 0 ? `, customer membayar ${rupiah(pay)}` : ' dengan total Rp 0'}.` });
    if (!ok) return;
    const o = await run(() => api.post<Order>('/free/claim', { customerId: row.id, serviceId: svc.id, qty }), 'Klaim FREE berhasil 🎉');
    if (o) onDone(o);
  };

  return (
    <Sheet open onClose={onClose} title={`Klaim FREE — ${row.name}`}>
      {!services.data ? <Spinner /> : (
        <>
          <p className="mb-2 font-semibold">Layanan cuci</p>
          <div className="mb-5 flex flex-wrap gap-2">
            {kgServices.map((s) => <button key={s.id} onClick={() => setServiceId(s.id)} className={`min-h-12 rounded-xl border-2 px-4 font-bold ${svc?.id === s.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line'}`}>{s.code}</button>)}
          </div>
          <p className="mb-2 font-semibold">Berat cucian</p>
          <Stepper value={qty} onChange={setQty} step={0.5} min={0.5} unit="kg" />
          <div className="mt-5 space-y-2 rounded-xl bg-slate-100 p-4">
            <p className="flex justify-between"><span>Harga normal</span><span>{rupiah(price?.subtotal)}</span></p>
            <p className="flex justify-between text-accent-800"><span>Potongan FREE (maks {kg(freeKg)})</span><span>− {rupiah(discount)}</span></p>
            <p className="flex justify-between text-lg font-extrabold"><span>Customer bayar</span><span>{rupiah(pay)}</span></p>
          </div>
          <Button size="lg" variant="success" className="mt-5 w-full" loading={busy} onClick={claim}>Klaim FREE</Button>
        </>
      )}
    </Sheet>
  );
}
