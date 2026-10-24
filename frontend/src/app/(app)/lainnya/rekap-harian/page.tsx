'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Empty, ErrorBox, PageHeader, Progress, Spinner } from '@/components/ui';
import { addDays, kg, longDate, todayStr } from '@/lib/format';
import { useApi } from '@/lib/swr';

interface Recap { date: string; hari: string; targetKg: number; staff: { userId: number; name: string; totalKg: number; kgWash?: number; kgIron?: number; kgWashIron?: number; orderCount: number; items: { customerId: number; name: string; kg: number }[] }[] }

/** Meniru buku target staff: tanggal · hari · nama · kg · rincian "Customer (kg)". */
export default function DailyRecapPage() {
  const [date, setDate] = useState(todayStr());
  const { data, error, mutate } = useApi<Recap>(`/staff/daily-recap?date=${date}`);
  return (
    <div>
      <PageHeader title="Rekap Harian Staff" back="/lainnya" />
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setDate(addDays(date, -1))} aria-label="Hari sebelumnya" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><ChevronLeft /></button>
        <input type="date" className="input max-w-[11rem] text-center font-bold" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button onClick={() => setDate(addDays(date, 1))} aria-label="Hari berikutnya" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><ChevronRight /></button>
      </div>
      <p className="mt-2 text-center text-sm text-slate-500">{longDate(date)}</p>
      <div className="mt-5 space-y-4">
        {error ? <ErrorBox error={error} retry={() => mutate()} /> : !data ? <Spinner /> : data.staff.length === 0 ? <Empty title="Belum ada cucian di tanggal ini" /> : data.staff.map((s) => (
          <div key={s.userId} className="card">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-lg font-bold">{s.name}</p>
              <p className="text-2xl font-extrabold">{kg(s.totalKg)}</p>
            </div>
            <Progress value={s.totalKg} max={data.targetKg} />
            <p className="mb-2 mt-1 text-xs text-slate-500">{s.totalKg >= data.targetKg ? `✓ Target ${kg(data.targetKg)} tercapai` : `Target ${kg(data.targetKg)} · kurang ${kg(data.targetKg - s.totalKg)}`} · {s.orderCount} nota</p>
            <p className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-brand-700"><span>Cuci {kg(s.kgWash ?? 0)}</span><span>Setrika {kg(s.kgIron ?? 0)}</span><span>Cuci + Setrika {kg(s.kgWashIron ?? 0)}</span></p>
            <p className="text-sm leading-relaxed text-slate-700">{s.items.map((i) => `${i.name} (${+i.kg.toFixed(2)})`).join(', ')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
