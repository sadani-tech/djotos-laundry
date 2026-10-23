'use client';
import { Gift, Search, Trash2, UserPlus, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { NewCustomerSheet } from '@/components/customer';
import { Button, Chip, Field, PageHeader, Progress, Segmented, Spinner, Stepper, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { kg, phoneShow, rupiah } from '@/lib/format';
import { CATEGORY_LABEL, linePrice } from '@/lib/pricing';
import { refreshAll, useApi } from '@/lib/swr';
import type { Customer, Order, Service } from '@/lib/types';

interface Line { serviceId: number; qty: number }
type PayNow = 'LATER' | 'CASH' | 'QRIS';

function NewOrder() {
  const router = useRouter();
  const sp = useSearchParams();
  const { run, busy } = useAction();
  const services = useApi<Service[]>('/services');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  const [payNow, setPayNow] = useState<PayNow>('LATER');
  const [showSatuan, setShowSatuan] = useState(false);

  // Customer dari link (mis. tombol "Order baru" di halaman customer)
  const presetId = sp.get('customerId');
  const preset = useApi<Customer>(presetId ? `/customers/${presetId}` : null);
  useEffect(() => { if (preset.data && !customer) setCustomer(preset.data); }, [preset.data, customer]);

  const svcMap = useMemo(() => new Map((services.data ?? []).map((s) => [s.id, s])), [services.data]);
  const priced = lines.map((l) => ({ ...l, svc: svcMap.get(l.serviceId)!, ...linePrice(svcMap.get(l.serviceId)!, l.qty) })).filter((l) => l.svc);
  const total = priced.reduce((s, l) => s + l.subtotal, 0);

  const addService = (s: Service) =>
    setLines((ls) => {
      const ex = ls.find((l) => l.serviceId === s.id);
      return ex ? ls.map((l) => (l === ex ? { ...l, qty: l.qty + 1 } : l)) : [...ls, { serviceId: s.id, qty: s.minQty }];
    });
  const setQty = (id: number, qty: number) => setLines((ls) => ls.map((l) => (l.serviceId === id ? { ...l, qty } : l)));
  const remove = (id: number) => setLines((ls) => ls.filter((l) => l.serviceId !== id));

  const save = async () => {
    if (!customer) return;
    const o = await run(() =>
      api.post<Order>('/orders', {
        customerId: customer.id,
        items: lines.map((l) => ({ serviceId: l.serviceId, qty: l.qty })),
        note: note.trim() || undefined,
        payment: payNow === 'LATER' ? undefined : { method: payNow },
      }),
    );
    if (o) { refreshAll(); router.replace(`/order/${o.id}?baru=1`); }
  };

  const groups = (['REGULER', 'EXPRESS'] as const).map((c) => ({ c, list: (services.data ?? []).filter((s) => s.category === c) }));
  const satuan = (services.data ?? []).filter((s) => s.category === 'SATUAN');

  const ServiceBtn = ({ s }: { s: Service }) => {
    const n = lines.find((l) => l.serviceId === s.id);
    return (
      <button
        onClick={() => addService(s)}
        className={`relative flex min-h-20 flex-col items-center justify-center rounded-2xl border-2 p-2 transition active:scale-95 ${n ? 'border-brand-600 bg-brand-50' : 'border-line bg-white hover:border-brand-500'}`}
      >
        <span className="text-2xl font-extrabold text-brand-700">{s.code}</span>
        <span className="line-clamp-1 text-xs text-slate-500">{s.name.replace(/ \(.*\)/, '')}</span>
        <span className="text-xs font-semibold text-slate-700">{rupiah(s.rate)}/{s.unit === 'KG' ? 'kg' : 'pcs'}</span>
        {n && <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-accent-500 px-1 text-xs font-extrabold text-ink shadow-sm">✓</span>}
      </button>
    );
  };

  return (
    <div className="pt-0">
      <PageHeader title="Order Baru" back="/" />

      {/* 1. Customer */}
      <section className="mb-6">
        <h2 className="mb-2 font-bold">1. Siapa customernya?</h2>
        <CustomerPicker value={customer} onChange={setCustomer} />
      </section>

      {/* 2. Layanan */}
      <section className="mb-6">
        <h2 className="mb-2 font-bold">2. Pilih layanan</h2>
        {!services.data ? <Spinner /> : (
          <div className="space-y-4">
            {groups.map(({ c, list }) => (
              <div key={c}>
                <p className="mb-1 text-sm font-semibold text-slate-500">{CATEGORY_LABEL[c]}</p>
                <div className="grid grid-cols-3 gap-3">{list.map((s) => <ServiceBtn key={s.id} s={s} />)}</div>
              </div>
            ))}
            {satuan.length > 0 && (
              <div>
                <button onClick={() => setShowSatuan((v) => !v)} className="mb-1 text-sm font-semibold text-brand-700">
                  {showSatuan ? '▾' : '▸'} Satuan (sprei, selimut, bed cover)
                </button>
                {(showSatuan || lines.some((l) => svcMap.get(l.serviceId)?.category === 'SATUAN')) && (
                  <div className="grid grid-cols-3 gap-3">{satuan.map((s) => <ServiceBtn key={s.id} s={s} />)}</div>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Berat */}
      {priced.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-bold">3. Berapa kg / pcs?</h2>
          <div className="space-y-4">
            {priced.map((l) => (
              <div key={l.serviceId} className="card">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <p className="font-bold"><span className="mr-2 rounded-md bg-brand-100 px-2 py-0.5 text-brand-700">{l.svc.code}</span>{l.svc.name}</p>
                    <p className="text-sm text-slate-500">
                      {rupiah(l.svc.rate)}/{l.svc.unit === 'KG' ? 'kg' : 'pcs'}
                      {l.svc.minQty > 1 && ` · minimal ${l.svc.minQty} ${l.svc.unit === 'KG' ? 'kg' : 'pcs'}`}
                    </p>
                  </div>
                  <button onClick={() => remove(l.serviceId)} aria-label="Hapus layanan" className="flex h-10 w-10 items-center justify-center rounded-full text-red-500 hover:bg-red-50"><Trash2 className="h-5 w-5" /></button>
                </div>
                {l.svc.unit === 'KG' && (
                  <div className="-mx-1 mb-4 flex flex-wrap gap-2 px-1">
                    {[3, 4, 5, 6, 7, 8, 10, 12].map((n) => (
                      <Chip key={n} active={l.qty === n} onClick={() => setQty(l.serviceId, n)}>{n} kg</Chip>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Stepper value={l.qty} onChange={(n) => setQty(l.serviceId, n)} step={l.svc.unit === 'KG' ? 0.5 : 1} min={l.svc.unit === 'KG' ? 0.1 : 1} unit={l.svc.unit === 'KG' ? 'kg' : 'pcs'} />
                  <p className="whitespace-nowrap text-xl font-extrabold">{rupiah(l.subtotal)}</p>
                </div>
                {l.billedQty > l.qty && <p className="mt-2 text-sm text-amber-700">Ditagih minimal {kg(l.billedQty)}.</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {customer && customer.free.count > 0 && (
        <div className={`mb-6 rounded-2xl border p-4 ${customer.free.eligible ? 'border-accent-300 bg-accent-50' : 'border-line bg-white'}`}>
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Gift className="h-4 w-4 text-accent-700" /> Progres FREE: {customer.free.count}/{customer.free.threshold}
          </div>
          <Progress value={customer.free.count} max={customer.free.threshold} />
          {customer.free.eligible && <p className="mt-1 text-sm font-semibold text-accent-800">Customer ini berhak cuci GRATIS — klaim di menu FREE.</p>}
        </div>
      )}

      {priced.length > 0 && (
        <Field label="Catatan (opsional)">
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="mis. sprei bernoda, jangan pakai pewangi" />
        </Field>
      )}

      {/* Ringkasan + simpan (menempel di bawah) */}
      <div className="sticky bottom-20 z-10 bleed mt-6 border-t border-line bg-white/95 py-5 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur md:bottom-0">
        <div className="mb-4 flex items-end justify-between">
          <span className="font-semibold text-slate-600">Total</span>
          <span className="text-3xl font-extrabold">{rupiah(total)}</span>
        </div>
        <Segmented<PayNow>
          className="mb-4"
          value={payNow}
          onChange={setPayNow}
          options={[{ value: 'LATER', label: 'Bayar nanti' }, { value: 'CASH', label: 'Lunas Cash' }, { value: 'QRIS', label: 'Lunas QRIS' }]}
        />
        <Button size="lg" className="w-full" loading={busy} disabled={!customer || priced.length === 0} onClick={save}>
          {!customer ? 'Pilih customer dulu' : priced.length === 0 ? 'Pilih layanan dulu' : 'Simpan Nota'}
        </Button>
      </div>
    </div>
  );
}

/** Cari customer atau tambah baru langsung dari sini. */
function CustomerPicker({ value, onChange }: { value: Customer | null; onChange: (c: Customer | null) => void }) {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const list = useApi<Customer[]>(value ? null : `/customers?sort=recent${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`);

  if (value) {
    return (
      <div className="card flex items-center gap-3 border-brand-500 bg-brand-50">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{value.name}</p>
          <p className="text-sm text-slate-600">{phoneShow(value.phone)}{value.unpaid > 0 && <span className="ml-2 font-bold text-red-600">Tagihan {rupiah(value.unpaid)}</span>}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => onChange(null)}><X className="h-4 w-4" /> Ganti</Button>
      </div>
    );
  }
  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-slate-400" />
        <input className="input pl-10" placeholder="Ketik nama atau no. WA…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-2 space-y-3">
        {!list.data ? <Spinner /> : list.data.slice(0, 5).map((c) => (
          <button key={c.id} onClick={() => onChange(c)} className="card flex w-full items-center justify-between text-left active:bg-surface">
            <span><span className="block font-bold">{c.name}</span><span className="text-sm text-slate-500">{phoneShow(c.phone)}</span></span>
            {c.unpaid > 0 && <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Tagihan {rupiah(c.unpaid)}</span>}
          </button>
        ))}
        <Button variant="secondary" className="w-full" onClick={() => setAdding(true)}><UserPlus className="h-5 w-5" /> Customer baru{q.trim() ? `: “${q.trim()}”` : ''}</Button>
      </div>
      <NewCustomerSheet open={adding} onClose={() => setAdding(false)} initialName={q} onCreated={(c) => { setAdding(false); onChange(c); }} />
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewOrder />
    </Suspense>
  );
}
