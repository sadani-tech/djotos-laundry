'use client';
import { Award, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { MonthNav } from '@/components/MonthNav';
import { Button, ErrorBox, PageHeader, Progress, Spinner, useAction, useConfirm } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateFmt, kg, rupiah } from '@/lib/format';
import { refreshAll, useApi } from '@/lib/swr';
import type { BonusLine, BonusRow } from '@/lib/types';

const currentMonth = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);

function Lines({ lines }: { lines: BonusLine[] }) {
  if (lines.length === 0) return <p className="text-sm text-slate-500">Belum ada aturan bonus yang aktif.</p>;
  return (
    <ul className="space-y-3">
      {lines.map((l) => {
        const unit = (n: number) => (l.metric === 'KG' ? kg(n) : rupiah(n));
        return (
          <li key={l.ruleId}>
            <div className="flex items-center justify-between">
              <p className="font-semibold">{l.name}<span className="ml-1 text-xs font-normal text-slate-500">({l.type === 'PER_KG' ? `${rupiah(l.value)}/kg` : `${l.value}% omzet`})</span></p>
              <p className={`font-extrabold ${l.achieved ? 'text-green-700' : 'text-slate-400'}`}>{rupiah(l.amount)}</p>
            </div>
            {l.minTarget > 0 && (
              <>
                <Progress value={l.current} max={l.minTarget} />
                <p className="mt-0.5 text-xs text-slate-500">{l.achieved ? `✓ Target ${unit(l.minTarget)} tercapai` : `${unit(l.current)} dari target ${unit(l.minTarget)} — kurang ${unit(l.minTarget - l.current)}`}</p>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function BonusPage() {
  const { isOwner } = useAuth();
  const [period, setPeriod] = useState(currentMonth());
  const confirm = useConfirm();
  const { run, busy } = useAction();
  const mine = useApi<BonusRow>(!isOwner ? `/bonus/me?period=${period}` : null);
  const all = useApi<BonusRow[]>(isOwner ? `/bonus/summary?period=${period}` : null);
  const reload = () => { mine.mutate(); all.mutate(); refreshAll(); };

  const generate = async () => {
    if (await run(() => api.post('/bonus/records/generate', { period }), 'Rekap bonus disimpan')) reload();
  };
  const pay = async (r: BonusRow) => {
    const ok = await confirm({ title: `Tandai bonus ${r.name} sudah dibayar?`, confirmText: 'Ya, sudah dibayar', message: `${rupiah(r.amount)} untuk ${period}. Angka akan dikunci dan tidak berubah lagi.` });
    if (ok && r.record && (await run(() => api.patch(`/bonus/records/${r.record!.id}/pay`), 'Bonus ditandai dibayar'))) reload();
  };

  const err = mine.error || all.error;
  return (
    <div>
      <PageHeader title={isOwner ? 'Bonus Staff' : 'Bonus Saya'} back="/lainnya" />
      <MonthNav value={period} onChange={setPeriod} />
      <p className="mt-2 text-center text-xs text-slate-500">Dihitung dari nota yang <b>sudah lunas</b>, tidak dibatalkan, dan bukan nota FREE.</p>
      {err ? <div className="mt-4"><ErrorBox error={err} /></div> : (!mine.data && !all.data) ? <Spinner /> : (
        <div className="mt-4 space-y-3">
          {(isOwner ? all.data! : [mine.data!]).map((r) => (
            <div key={r.userId} className="card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="flex items-center gap-1 text-sm font-semibold text-slate-500"><Award className="h-4 w-4" /> {isOwner ? r.name : 'Bonus bulan ini'}</p>
                  <p className="text-3xl font-extrabold text-brand-700">{rupiah(r.amount)}</p>
                </div>
                {r.record?.status === 'PAID' && <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800"><CheckCircle2 className="h-4 w-4" /> Dibayar {r.record.paidAt ? dateFmt(r.record.paidAt, { day: 'numeric', month: 'short' }) : ''}</span>}
                {r.record?.status === 'DRAFT' && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Tersimpan</span>}
              </div>
              <div className="my-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-lg bg-slate-100 p-2"><p className="text-slate-500">Nota</p><p className="font-bold">{r.orderCount}</p></div>
                <div className="rounded-lg bg-slate-100 p-2"><p className="text-slate-500">Cucian</p><p className="font-bold">{kg(r.totalKg)}</p></div>
                <div className="rounded-lg bg-slate-100 p-2"><p className="text-slate-500">Omzet</p><p className="font-bold">{rupiah(r.omzet)}</p></div>
              </div>
              <Lines lines={r.lines} />
              {isOwner && r.record?.status === 'DRAFT' && <Button className="mt-3 w-full" variant="success" onClick={() => pay(r)}>Tandai sudah dibayar</Button>}
            </div>
          ))}
          {isOwner && <Button size="lg" variant="secondary" className="w-full" loading={busy} onClick={generate}>Simpan rekap bulan ini</Button>}
        </div>
      )}
    </div>
  );
}
