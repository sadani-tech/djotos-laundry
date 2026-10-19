'use client';
import { useEffect, useState } from 'react';
import { Button, ErrorBox, Field, PageHeader, Spinner, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { useApi } from '@/lib/swr';
import type { Settings } from '@/lib/types';

const PLACEHOLDERS = ['{nama}', '{no_nota}', '{total}', '{status_bayar}', '{sisa}', '{layanan}', '{toko}'];

function Section({ title, children, onSave, busy }: { title: string; children: React.ReactNode; onSave: () => void; busy: boolean }) {
  return (
    <section className="card mb-4">
      <h2 className="mb-3 text-lg font-bold">{title}</h2>
      {children}
      <Button className="w-full" loading={busy} onClick={onSave}>Simpan {title.toLowerCase()}</Button>
    </section>
  );
}

export default function SettingsPage() {
  const { data, error, mutate } = useApi<Settings>('/settings');
  const [s, setS] = useState<Settings | null>(null);
  const { run, busy } = useAction();
  useEffect(() => { if (data) setS(data); }, [data]);
  if (error) return <><PageHeader title="Pengaturan" back="/lainnya" /><ErrorBox error={error} /></>;
  if (!s) return <><PageHeader title="Pengaturan" back="/lainnya" /><Spinner /></>;

  const save = async (section: keyof Settings, msg: string) => {
    const r = await run(() => api.put<Settings>('/settings', { [section]: s[section] }), msg);
    if (r) { setS(r); mutate(r); }
  };
  const up = <K extends keyof Settings>(k: K, patch: Partial<Settings[K]>) => setS({ ...s, [k]: { ...s[k], ...patch } });

  return (
    <div>
      <PageHeader title="Pengaturan" back="/lainnya" />

      <Section title="Data toko" busy={busy} onSave={() => save('shop', 'Data toko disimpan')}>
        <Field label="Nama toko"><input className="input" value={s.shop.name} onChange={(e) => up('shop', { name: e.target.value })} /></Field>
        <Field label="Alamat"><input className="input" value={s.shop.address} onChange={(e) => up('shop', { address: e.target.value })} /></Field>
        <Field label="No. telepon / WA toko"><input className="input" value={s.shop.phone} onChange={(e) => up('shop', { phone: e.target.value })} /></Field>
        <Field label="Tulisan di bawah nota"><input className="input" value={s.shop.footer} onChange={(e) => up('shop', { footer: e.target.value })} /></Field>
      </Section>

      <Section title="Program FREE" busy={busy} onSave={() => save('free', 'Pengaturan FREE disimpan')}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jumlah nota untuk 1× gratis"><input className="input" inputMode="numeric" value={s.free.threshold} onChange={(e) => up('free', { threshold: parseInt(e.target.value.replace(/\D/g, '') || '0', 10) })} /></Field>
          <Field label="Jatah gratis (kg)"><input className="input" inputMode="decimal" value={s.free.freeKg} onChange={(e) => up('free', { freeKg: parseFloat(e.target.value.replace(',', '.')) || 0 })} /></Field>
        </div>
        <label className="mb-4 flex items-center gap-3 font-semibold"><input type="checkbox" className="h-6 w-6 accent-brand-600" checked={s.free.notifyReady} onChange={(e) => up('free', { notifyReady: e.target.checked })} /> Kirim WA ke customer saat progres penuh</label>
        <p className="mb-4 text-sm text-slate-500">Layanan mana yang dihitung diatur di menu Layanan & Harga.</p>
      </Section>

      <Section title="Pesan WhatsApp" busy={busy} onSave={() => save('wa', 'Template WhatsApp disimpan')}>
        <label className="mb-4 flex items-center gap-3 font-semibold"><input type="checkbox" className="h-6 w-6 accent-brand-600" checked={s.wa.autoSendFinished} onChange={(e) => up('wa', { autoSendFinished: e.target.checked })} /> Kirim otomatis saat status “Selesai”</label>
        <p className="mb-1 text-sm text-slate-500">Kata yang otomatis terganti:</p>
        <div className="mb-3 flex flex-wrap gap-1">{PLACEHOLDERS.map((p) => <code key={p} className="rounded bg-slate-100 px-2 py-1 text-xs">{p}</code>)}</div>
        <Field label="Pesan cucian selesai"><textarea className="input min-h-40 py-3" value={s.wa.finishedTemplate} onChange={(e) => up('wa', { finishedTemplate: e.target.value })} /></Field>
        <Field label="Pesan hadiah FREE siap"><textarea className="input min-h-32 py-3" value={s.wa.freeReadyTemplate} onChange={(e) => up('wa', { freeReadyTemplate: e.target.value })} /></Field>
      </Section>

      <Section title="Target staff" busy={busy} onSave={() => save('staff', 'Target disimpan')}>
        <Field label="Target cucian per staff per hari (kg)"><input className="input" inputMode="decimal" value={s.staff.dailyTargetKg} onChange={(e) => up('staff', { dailyTargetKg: parseFloat(e.target.value.replace(',', '.')) || 0 })} /></Field>
      </Section>
    </div>
  );
}
