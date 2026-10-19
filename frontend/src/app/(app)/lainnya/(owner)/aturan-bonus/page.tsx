'use client';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, ErrorBox, Field, PageHeader, Spinner, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/swr';
import type { BonusRule } from '@/lib/types';

export default function BonusRulesPage() {
  const { data, error, mutate } = useApi<BonusRule[]>('/bonus/rules');
  const { run, busy } = useAction();
  const [rules, setRules] = useState<BonusRule[]>([]);
  useEffect(() => { if (data) setRules(data); }, [data]);

  const set = (i: number, patch: Partial<BonusRule>) => setRules((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const save = async () => {
    const r = await run(() => api.put<BonusRule[]>('/bonus/rules', { rules }), 'Aturan bonus disimpan');
    if (r) { setRules(r); mutate(r); }
  };

  return (
    <div>
      <PageHeader title="Aturan Bonus" back="/lainnya" />
      <p className="mb-4 rounded-xl bg-brand-50 p-3 text-sm text-brand-700">Bonus dihitung otomatis tiap bulan. Aturan yang aktif <b>dijumlahkan</b>. Bonus hanya cair jika target minimum bulan itu tercapai (isi 0 bila tanpa target).</p>
      {error ? <ErrorBox error={error} /> : !data ? <Spinner /> : (
        <div className="space-y-3">
          {rules.map((r, i) => (
            <div key={r.id ?? `n${i}`} className="card">
              <Field label="Nama aturan"><input className="input" value={r.name} onChange={(e) => set(i, { name: e.target.value })} /></Field>
              <Field label="Jenis bonus">
                <select className="input" value={r.type} onChange={(e) => set(i, { type: e.target.value as BonusRule['type'] })}>
                  <option value="PER_KG">Per kg yang dicuci (Rp per kg)</option>
                  <option value="PERCENT_OMZET">Persen dari omzet (%)</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={r.type === 'PER_KG' ? 'Rp per kg' : 'Persen (%)'}><input className="input" inputMode="decimal" value={r.value} onChange={(e) => set(i, { value: parseFloat(e.target.value.replace(',', '.')) || 0 })} /></Field>
                <Field label={r.type === 'PER_KG' ? 'Target min. (kg/bulan)' : 'Target min. omzet (Rp)'}><input className="input" inputMode="numeric" value={r.minTarget} onChange={(e) => set(i, { minTarget: parseInt(e.target.value.replace(/\D/g, '') || '0', 10) })} /></Field>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="h-6 w-6 accent-brand-600" checked={r.isActive} onChange={(e) => set(i, { isActive: e.target.checked })} /> Aktif</label>
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setRules((rs) => rs.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /> Hapus</Button>
              </div>
            </div>
          ))}
          <Button variant="secondary" className="w-full" onClick={() => setRules((rs) => [...rs, { name: 'Aturan baru', type: 'PER_KG', value: 100, minTarget: 0, isActive: true }])}><Plus className="h-5 w-5" /> Tambah aturan</Button>
          <Button size="lg" className="w-full" loading={busy} onClick={save}>Simpan aturan</Button>
        </div>
      )}
    </div>
  );
}
