'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Empty, ErrorBox, PageHeader, Progress, Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { addDays, kg, longDate, todayStr } from '@/lib/format';
import { useApi } from '@/lib/swr';

interface IroningOrder { id: number; orderId: number; invoiceNo: string; customerName: string; kg: number; completedAt: string }
interface Recap { date: string; hari: string; targetKg: number; totalKg: number; staff: { userId: number; name: string; totalKg: number; entries: IroningOrder[]; items: { customerId: number; name: string; kg: number }[] }[] }

export default function DailyRecapPage() {
  const { isOwner } = useAuth();
  const [date, setDate] = useState(todayStr());
  const { data, error, mutate } = useApi<Recap>(`/staff/daily-recap?date=${date}`);

  return (
    <div>
      <PageHeader title="Hasil Setrika Harian" back="/lainnya" />
      <p className="mb-4 text-sm text-slate-600">Rekap KG yang dicatat setiap pegawai dari pesanan pelanggan, termasuk pekerjaan sebagian yang dilanjutkan di hari lain.</p>
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setDate(addDays(date, -1))} aria-label="Hari sebelumnya" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"><ChevronLeft /></button>
        <input aria-label="Tanggal rekap" type="date" className="input min-w-0 max-w-[11rem] text-center font-bold" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button onClick={() => setDate(addDays(date, 1))} aria-label="Hari berikutnya" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"><ChevronRight /></button>
      </div>
      <p className="mt-2 text-center text-sm text-slate-500">{longDate(date)}</p>
      <div className="mt-5 space-y-4">
        {error ? <ErrorBox error={error} retry={() => mutate()} /> : !data ? <Spinner /> : <>
          <div className="card border-brand-200 bg-brand-50 text-center">
            <p className="text-sm font-semibold text-brand-700">{isOwner ? 'Total setrika semua pegawai' : 'Total setrika saya'} pada tanggal ini</p>
            <p className="mt-1 text-3xl font-extrabold text-brand-800">{kg(data.totalKg)}</p>
          </div>
          {data.staff.length === 0 ? <Empty title="Belum ada setrika dicatat di tanggal ini" hint="Catat KG yang dikerjakan dari menu Setrika di beranda." /> : data.staff.map((s) => (
            <div key={s.userId} className="card">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 break-words text-lg font-bold">{s.name}</p>
                <p className="text-2xl font-extrabold">{kg(s.totalKg)}</p>
              </div>
              <Progress value={s.totalKg} max={data.targetKg} />
              <p className="mb-4 mt-1 text-xs text-slate-500">{s.totalKg >= data.targetKg ? `✓ Target ${kg(data.targetKg)} tercapai` : `Target ${kg(data.targetKg)} · kurang ${kg(data.targetKg - s.totalKg)}`}</p>
              <h2 className="mb-2 text-sm font-bold">Total per customer</h2>
              <div className="divide-y divide-line">
                {s.items.map((item) => <div key={item.customerId} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 break-words">{item.name}</span><span className="shrink-0 font-bold">{kg(item.kg)}</span></div>)}
              </div>
              <details className="mt-4 border-t border-line pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand-700">Sesi setrika dari pesanan ({s.entries.length})</summary>
                <div className="mt-2 divide-y divide-line">
                  {s.entries.map((entry) => <Link key={entry.id} href={`/order/${entry.orderId}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:text-brand-700">
                    <span className="min-w-0"><span className="block truncate font-semibold">{entry.customerName}</span><span className="text-slate-500">{entry.invoiceNo} · {new Date(entry.completedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span></span>
                    <span className="shrink-0 font-bold">{kg(entry.kg)}</span>
                  </Link>)}
                </div>
              </details>
            </div>
          ))}
        </>}
      </div>
    </div>
  );
}
