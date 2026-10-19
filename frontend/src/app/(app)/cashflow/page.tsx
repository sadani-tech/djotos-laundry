'use client';
import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight, Download, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { CASH_COLOR, DailyBars, Donut, QRIS_COLOR } from '@/components/charts';
import { Button, Empty, ErrorBox, Field, MethodBadge, PageHeader, Segmented, Sheet, Spinner, useAction, useConfirm } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { addDays, addMonths, dateFmt, longDate, monthLabel, rupiah, timeFmt, todayStr } from '@/lib/format';
import { refreshAll, useApi } from '@/lib/swr';
import type { CashEntry, CashSummary, PayMethod, User } from '@/lib/types';

type Period = 'day' | 'week' | 'month';
const CATEGORIES = ['Deterjen', 'Pewangi', 'Plastik', 'Listrik', 'Air', 'Gas', 'Gaji', 'Perawatan mesin', 'Lainnya'];

export default function CashflowPage() {
  const { isOwner } = useAuth();
  const [period, setPeriod] = useState<Period>('day');
  const [date, setDate] = useState(todayStr());
  const [staffId, setStaffId] = useState('');
  const [adding, setAdding] = useState(false);
  const confirm = useConfirm();
  const { run, busy } = useAction();

  const qs = `period=${period}&date=${date}${staffId ? `&staffId=${staffId}` : ''}`;
  const sum = useApi<CashSummary>(`/cashflow/summary?${qs}`);
  const entries = useApi<CashEntry[]>(`/cashflow/entries?${qs}`);
  const users = useApi<User[]>(isOwner ? '/users' : null);
  const reload = () => { sum.mutate(); entries.mutate(); refreshAll(); };

  const step = (n: number) => setDate(period === 'month' ? addMonths(date.slice(0, 7), n) + '-01' : addDays(date, n * (period === 'week' ? 7 : 1)));
  const s = sum.data;
  const label = !s ? '' : period === 'day' ? longDate(s.from) : period === 'week' ? `${dateFmt(s.from, { day: 'numeric', month: 'short' })} – ${dateFmt(s.to, { day: 'numeric', month: 'short', year: 'numeric' })}` : monthLabel(s.from.slice(0, 7));

  const delExpense = async (e: CashEntry) => {
    const ok = await confirm({ title: 'Hapus pengeluaran ini?', danger: true, confirmText: 'Ya, hapus', message: `${e.title} ${rupiah(e.amount)}` });
    if (ok && (await run(() => api.del(`/expenses/${e.id}`), 'Pengeluaran dihapus'))) reload();
  };

  return (
    <div>
      <PageHeader title="Cashflow" right={
        <Button size="sm" variant="secondary" loading={busy} onClick={() => run(() => api.download(`/cashflow/export?${qs}`, `cashflow-${period}-${date}.xlsx`))}><Download className="h-4 w-4" /> Excel</Button>
      } />
      <Segmented<Period> value={period} onChange={setPeriod} options={[{ value: 'day', label: 'Harian' }, { value: 'week', label: 'Mingguan' }, { value: 'month', label: 'Bulanan' }]} />
      <div className="mt-3 flex items-center justify-between gap-2">
        <button onClick={() => step(-1)} aria-label="Sebelumnya" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><ChevronLeft /></button>
        <button onClick={() => setDate(todayStr())} className="flex-1 text-center font-bold">{label || '…'}{date !== todayStr() && <span className="block text-xs font-semibold text-brand-700">Ke hari ini</span>}</button>
        <button onClick={() => step(1)} aria-label="Berikutnya" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><ChevronRight /></button>
      </div>
      {isOwner && users.data && (
        <select className="input mt-3" value={staffId} onChange={(e) => setStaffId(e.target.value)} aria-label="Filter staff">
          <option value="">Semua staff</option>
          {users.data.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      )}
      {s?.scope === 'mine' && <p className="mt-3 rounded-xl bg-slate-100 p-2 text-center text-sm text-slate-600">Menampilkan pembayaran & pengeluaran yang Anda catat sendiri.</p>}

      {sum.error ? <div className="mt-4"><ErrorBox error={sum.error} retry={() => sum.mutate()} /></div> : !s ? <Spinner /> : (
        <>
          {/* Ringkasan */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="card p-3"><p className="flex items-center gap-1 text-sm font-semibold text-green-700"><ArrowDownCircle className="h-4 w-4" /> Masuk</p><p className="mt-1 whitespace-nowrap text-xl font-extrabold text-green-700">{rupiah(s.income.total)}</p></div>
            <div className="card p-3"><p className="flex items-center gap-1 text-sm font-semibold text-red-600"><ArrowUpCircle className="h-4 w-4" /> Keluar</p><p className="mt-1 whitespace-nowrap text-xl font-extrabold text-red-600">{rupiah(s.expense.total)}</p></div>
            <div className="card col-span-2 flex items-center justify-between p-3"><p className="font-semibold text-slate-600">Bersih (masuk − keluar)</p><p className={`whitespace-nowrap text-2xl font-extrabold ${s.net < 0 ? 'text-red-600' : ''}`}>{rupiah(s.net)}</p></div>
          </div>
          {s.receivable > 0 && (
            <Link href="/" className="mt-2 block rounded-xl bg-red-50 p-3 text-center text-sm font-semibold text-red-700">Masih ada tagihan belum dibayar dari nota periode ini: {rupiah(s.receivable)}</Link>
          )}

          {/* Pembanding Cash vs QRIS */}
          <div className="card mt-3">
            <h2 className="mb-3 font-bold">Cash vs QRIS</h2>
            <div className="flex items-center gap-4">
              <Donut cash={s.income.cash} qris={s.income.qris} />
              <ul className="flex-1 space-y-3">
                <li>
                  <p className="flex items-center gap-2 text-sm font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: CASH_COLOR }} /> Cash <span className="ml-auto font-extrabold">{s.income.cashPct}%</span></p>
                  <p className="pl-5 text-lg font-extrabold">{rupiah(s.income.cash)}</p>
                </li>
                <li>
                  <p className="flex items-center gap-2 text-sm font-semibold"><span className="h-3 w-3 rounded-full" style={{ background: QRIS_COLOR }} /> QRIS <span className="ml-auto font-extrabold">{s.income.qrisPct}%</span></p>
                  <p className="pl-5 text-lg font-extrabold">{rupiah(s.income.qris)}</p>
                </li>
              </ul>
            </div>
            {s.income.total > 0 && (
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-200" aria-hidden>
                <div style={{ width: `${s.income.cashPct}%`, background: CASH_COLOR }} />
                <div style={{ width: `${s.income.qrisPct}%`, background: QRIS_COLOR }} />
              </div>
            )}
            <p className="mt-3 text-sm text-slate-500">Kas bersih Cash (setelah pengeluaran Cash): <b className="text-slate-800">{rupiah(s.netCash)}</b></p>
          </div>

          {period !== 'day' && (
            <div className="card mt-3">
              <h2 className="mb-3 font-bold">Pemasukan per hari</h2>
              <DailyBars data={s.daily} />
              <div className="mt-2 flex justify-center gap-4 text-xs text-slate-600"><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" />Cash</span><span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-sky-600" />QRIS</span></div>
            </div>
          )}

          {s.expense.byCategory.length > 0 && (
            <div className="card mt-3">
              <h2 className="mb-2 font-bold">Pengeluaran per kategori</h2>
              <ul className="space-y-1">{s.expense.byCategory.map((c) => <li key={c.category} className="flex justify-between"><span>{c.category}</span><b>{rupiah(c.amount)}</b></li>)}</ul>
            </div>
          )}
        </>
      )}

      {/* Buku kas */}
      <h2 className="mb-2 mt-6 text-lg font-bold">Buku kas</h2>
      <div className="space-y-2">
        {!entries.data ? <Spinner /> : entries.data.length === 0 ? <Empty title="Belum ada transaksi" hint="Pembayaran nota dan pengeluaran akan tampil di sini." /> : entries.data.map((e) => (
          <div key={`${e.kind}${e.id}`} className="card flex items-center gap-3 p-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${e.kind === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{e.kind === 'IN' ? <ArrowDownCircle /> : <ArrowUpCircle />}</span>
            <div className="min-w-0 flex-1">
              {e.orderId ? <Link href={`/order/${e.orderId}`} className="block truncate font-bold hover:underline">{e.title}</Link> : <p className="truncate font-bold">{e.title}</p>}
              <p className="truncate text-sm text-slate-500">{e.subtitle ? e.subtitle + ' · ' : ''}{period !== 'day' && dateFmt(e.at, { day: 'numeric', month: 'short' }) + ' '}{timeFmt(e.at)} · {e.by}</p>
            </div>
            <div className="text-right">
              <p className={`font-extrabold ${e.kind === 'IN' ? 'text-green-700' : 'text-red-600'}`}>{e.kind === 'IN' ? '+' : '−'}{rupiah(e.amount)}</p>
              <MethodBadge method={e.method} />
            </div>
            {e.kind === 'OUT' && <button onClick={() => delExpense(e)} aria-label="Hapus pengeluaran" className="flex h-9 w-9 items-center justify-center rounded-full text-red-500 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
          </div>
        ))}
      </div>

      <button onClick={() => setAdding(true)} className="fixed bottom-24 right-4 z-20 flex h-14 items-center gap-2 rounded-full bg-red-600 px-5 font-bold text-white shadow-lg active:bg-red-700 md:bottom-8"><Plus className="h-6 w-6" /> Pengeluaran</button>
      <ExpenseSheet open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />
    </div>
  );
}

function ExpenseSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { run, busy } = useAction();
  const [category, setCategory] = useState('Deterjen');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PayMethod>('CASH');
  const n = parseInt(amount.replace(/\D/g, '') || '0', 10);
  const save = async () => {
    if (await run(() => api.post('/expenses', { category, description: description || undefined, amount: n, method }), 'Pengeluaran dicatat')) { setAmount(''); setDescription(''); onDone(); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Catat pengeluaran">
      <div className="mb-4 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => <button key={c} onClick={() => setCategory(c)} className={`min-h-10 rounded-full border px-4 text-sm font-semibold ${category === c ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>{c}</button>)}
      </div>
      <Field label="Nominal (Rp)"><input className="input text-xl font-bold" inputMode="numeric" value={n ? n.toLocaleString('id-ID') : ''} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
      <Field label="Keterangan (opsional)"><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="mis. Rinso 5 kg" /></Field>
      <Segmented<PayMethod> className="mb-4" value={method} onChange={setMethod} options={[{ value: 'CASH', label: 'Dibayar Cash' }, { value: 'QRIS', label: 'Dibayar QRIS' }]} />
      <Button size="lg" className="w-full" loading={busy} disabled={n < 1} onClick={save}>Simpan Pengeluaran</Button>
    </Sheet>
  );
}
