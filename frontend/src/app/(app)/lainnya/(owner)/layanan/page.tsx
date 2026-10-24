'use client';
import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, ErrorBox, Field, PageHeader, Sheet, Spinner, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { rupiah } from '@/lib/format';
import { CATEGORY_LABEL, WORK_LABEL } from '@/lib/pricing';
import { refreshAll, useApi } from '@/lib/swr';
import type { Service, WorkType } from '@/lib/types';

type Form = { code: string; name: string; category: Service['category']; unit: Service['unit']; rate: string; minQty: string; minPrice: string; workType: WorkType; countsForFree: boolean; isActive: boolean };
const empty: Form = { code: '', name: '', category: 'REGULER', unit: 'KG', rate: '', minQty: '1', minPrice: '', workType: 'OTHER', countsForFree: false, isActive: true };
const toForm = (s: Service): Form => ({ code: s.code, name: s.name, category: s.category, unit: s.unit, rate: String(s.rate), minQty: String(s.minQty), minPrice: s.minPrice ? String(s.minPrice) : '', workType: s.workType ?? 'OTHER', countsForFree: s.countsForFree, isActive: s.isActive });
const num = (v: string) => parseFloat(v.replace(',', '.')) || 0;

export default function ServicesPage() {
  const { data, error, mutate } = useApi<Service[]>('/services?all=1');
  const [edit, setEdit] = useState<Service | 'new' | null>(null);

  return (
    <div>
      <PageHeader title="Layanan & Harga" back="/lainnya" right={<Button size="sm" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> Layanan</Button>} />
      {error ? <ErrorBox error={error} /> : !data ? <Spinner /> : (['REGULER', 'EXPRESS', 'SATUAN'] as const).map((cat) => (
        <section key={cat} className="mb-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">{CATEGORY_LABEL[cat]}</h2>
          <div className="space-y-3">
            {data.filter((s) => s.category === cat).map((s) => (
              <button key={s.id} onClick={() => setEdit(s)} className={`card flex w-full items-center gap-4 p-4 text-left ${s.isActive ? '' : 'opacity-50'}`}>
                <span className="flex h-12 min-w-16 shrink-0 items-center justify-center rounded-xl bg-brand-100 px-2 text-lg font-extrabold text-brand-700">{s.code}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{s.name}{!s.isActive && ' (nonaktif)'}</span>
                  <span className="block text-sm text-slate-500">{rupiah(s.rate)}/{s.unit === 'KG' ? 'kg' : 'pcs'}{s.minQty > 1 ? ` · min ${s.minQty}` : ''}{s.minPrice ? ` · min ${rupiah(s.minPrice)}` : ''}{s.unit === 'KG' ? ` · ${WORK_LABEL[s.workType ?? 'OTHER']}` : ''}{s.countsForFree ? ' · dihitung FREE' : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {edit && <ServiceSheet service={edit === 'new' ? null : edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); mutate(); refreshAll(); }} />}
    </div>
  );
}

function ServiceSheet({ service, onClose, onDone }: { service: Service | null; onClose: () => void; onDone: () => void }) {
  const { run, busy } = useAction();
  const [f, setF] = useState<Form>(service ? toForm(service) : empty);
  useEffect(() => setF(service ? toForm(service) : empty), [service]);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));

  const save = async () => {
    const body = { name: f.name, category: f.category, unit: f.unit, rate: Math.round(num(f.rate)), minQty: num(f.minQty) || 1, minPrice: f.minPrice ? Math.round(num(f.minPrice)) : null, workType: f.unit === 'KG' ? f.workType : 'OTHER', countsForFree: f.countsForFree, isActive: f.isActive };
    const r = await run(() => (service ? api.patch(`/services/${service.id}`, body) : api.post('/services', { ...body, code: f.code })), 'Layanan disimpan');
    if (r) onDone();
  };
  const unit = f.unit === 'KG' ? 'kg' : 'pcs';

  return (
    <Sheet open onClose={onClose} title={service ? `Ubah ${service.code}` : 'Layanan baru'}>
      {!service && <Field label="Kode" hint="2–6 huruf/angka, mis. GRD. Tidak bisa diubah setelah dibuat."><input className="input uppercase" value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} maxLength={6} /></Field>}
      <Field label="Nama layanan"><input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} /></Field>
      {!service && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategori"><select className="input" value={f.category} onChange={(e) => set({ category: e.target.value as Form['category'] })}><option value="REGULER">Reguler</option><option value="EXPRESS">Express</option><option value="SATUAN">Satuan</option></select></Field>
          <Field label="Satuan"><select className="input" value={f.unit} onChange={(e) => set({ unit: e.target.value as Form['unit'] })}><option value="KG">Per kg</option><option value="PCS">Per pcs</option></select></Field>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Harga per ${unit} (Rp)`}><input className="input" inputMode="numeric" value={f.rate} onChange={(e) => set({ rate: e.target.value.replace(/\D/g, '') })} /></Field>
        <Field label={`Minimal (${unit})`}><input className="input" inputMode="decimal" value={f.minQty} onChange={(e) => set({ minQty: e.target.value })} /></Field>
        <Field label="Harga minimum (Rp)" hint="Kosongkan bila tidak ada. CK 3 kg = 16.000."><input className="input" inputMode="numeric" value={f.minPrice} onChange={(e) => set({ minPrice: e.target.value.replace(/\D/g, '') })} /></Field>
      </div>
      {f.unit === 'KG' && (
        <Field label="Jenis kerja" hint="Dipakai untuk memisahkan kg cuci dan kg setrika di Staff & Performa.">
          <select className="input" value={f.workType} onChange={(e) => set({ workType: e.target.value as WorkType })}>
            <option value="WASH">Cuci saja</option>
            <option value="IRON">Setrika saja</option>
            <option value="WASH_IRON">Cuci + setrika sekaligus</option>
            <option value="OTHER">Lainnya</option>
          </select>
        </Field>
      )}
      <label className="mb-4 flex items-center gap-3 font-semibold"><input type="checkbox" className="h-6 w-6 accent-brand-600" checked={f.countsForFree} onChange={(e) => set({ countsForFree: e.target.checked })} /> Dihitung untuk program FREE</label>
      <label className="mb-6 flex items-center gap-3 font-semibold"><input type="checkbox" className="h-6 w-6 accent-brand-600" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} /> Aktif (tampil di order)</label>
      <Button size="lg" className="w-full" loading={busy} disabled={!f.name || !f.rate || (!service && f.code.length < 2)} onClick={save}>Simpan</Button>
    </Sheet>
  );
}
