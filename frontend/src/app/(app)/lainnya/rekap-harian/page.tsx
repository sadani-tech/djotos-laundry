'use client';
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, Empty, ErrorBox, Field, PageHeader, Progress, Sheet, Spinner, useAction, useConfirm } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { addDays, kg, longDate, todayStr } from '@/lib/format';
import { refreshAll, useApi } from '@/lib/swr';
import type { User } from '@/lib/types';

interface Entry { id: number; customerName: string; kg: number }
interface Recap { date: string; hari: string; targetKg: number; totalKg: number; staff: { userId: number; name: string; totalKg: number; entries: Entry[]; items: { name: string; kg: number }[] }[] }
interface Editing { date: string; staffId: number; entry?: Entry }

export default function DailyRecapPage() {
  const { user, isOwner } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [editing, setEditing] = useState<Editing | null>(null);
  const { data, error, mutate } = useApi<Recap>(`/staff/daily-recap?date=${date}`);
  const users = useApi<User[]>(isOwner ? '/users' : null);
  const confirm = useConfirm();
  const { run, busy } = useAction();
  const remove = async (entry: Entry) => {
    if (await confirm({ title: `Hapus hasil setrika ${entry.customerName}?`, message: `${kg(entry.kg)} akan dikeluarkan dari rekap.`, confirmText: 'Ya, hapus', danger: true })) {
      if (await run(() => api.del(`/staff/ironing/${entry.id}`), 'Catatan dihapus')) void refreshAll();
    }
  };

  return (
    <div>
      <PageHeader title="Hasil Setrika Harian" back="/lainnya" />
      <p className="mb-4 text-sm text-slate-600">Catat hasil setrika sesuai pegawai yang mengerjakan dan tanggal selesai setrika.</p>
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setDate(addDays(date, -1))} aria-label="Hari sebelumnya" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"><ChevronLeft /></button>
        <input aria-label="Tanggal rekap" type="date" className="input min-w-0 max-w-[11rem] text-center font-bold" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button onClick={() => setDate(addDays(date, 1))} aria-label="Hari berikutnya" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"><ChevronRight /></button>
      </div>
      <p className="mt-2 text-center text-sm text-slate-500">{longDate(date)}</p>
      <Button className="mt-5 w-full" size="lg" disabled={!user} onClick={() => setEditing({ date, staffId: user!.id })}><Plus className="h-5 w-5" /> Catat hasil setrika</Button>
      <div className="mt-5 space-y-4">
        {error ? <ErrorBox error={error} retry={() => mutate()} /> : !data ? <Spinner /> : <>
          <div className="card border-brand-200 bg-brand-50 text-center">
            <p className="text-sm font-semibold text-brand-700">{isOwner ? 'Total setrika semua pegawai' : 'Total setrika saya'} pada tanggal ini</p>
            <p className="mt-1 text-3xl font-extrabold text-brand-800">{kg(data.totalKg)}</p>
          </div>
          {data.staff.length === 0 ? <Empty title="Belum ada hasil setrika di tanggal ini" hint="Tambahkan nama customer dan berat hasil setrikanya." /> : data.staff.map((s) => (
            <div key={s.userId} className="card">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 break-words text-lg font-bold">{s.name}</p>
                <p className="text-2xl font-extrabold">{kg(s.totalKg)}</p>
              </div>
              <Progress value={s.totalKg} max={data.targetKg} />
              <p className="mb-4 mt-1 text-xs text-slate-500">{s.totalKg >= data.targetKg ? `✓ Target ${kg(data.targetKg)} tercapai` : `Target ${kg(data.targetKg)} · kurang ${kg(data.targetKg - s.totalKg)}`}</p>
              <h2 className="mb-2 text-sm font-bold">Total per customer</h2>
              <div className="divide-y divide-line">
                {s.items.map((i) => <div key={i.name.toLocaleLowerCase('id-ID')} className="flex items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 break-words">{i.name}</span><span className="shrink-0 font-bold">{kg(i.kg)}</span></div>)}
              </div>
              <details className="mt-4 border-t border-line pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-brand-700">Catatan input ({s.entries.length}) · ubah / hapus</summary>
                <div className="mt-2 divide-y divide-line">
                  {s.entries.map((e) => <div key={e.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1 text-sm"><p className="break-words font-semibold">{e.customerName}</p><p className="text-slate-500">{kg(e.kg)}</p></div>
                    <Button size="sm" variant="secondary" aria-label={`Ubah catatan ${e.customerName}`} onClick={() => setEditing({ date, staffId: s.userId, entry: e })}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="secondary" disabled={busy} aria-label={`Hapus catatan ${e.customerName}`} onClick={() => remove(e)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                  </div>)}
                </div>
              </details>
            </div>
          ))}
        </>}
      </div>
      {editing && <EntrySheet editing={editing} isOwner={isOwner} users={users.data} usersError={users.error} retryUsers={() => users.mutate()} onClose={() => setEditing(null)} onDone={(savedDate) => { setEditing(null); setDate(savedDate); void refreshAll(); }} />}
    </div>
  );
}

function EntrySheet({ editing, isOwner, users, usersError, retryUsers, onClose, onDone }: { editing: Editing; isOwner: boolean; users?: User[]; usersError: unknown; retryUsers: () => void; onClose: () => void; onDone: (date: string) => void }) {
  const [date, setDate] = useState(editing.date);
  const [staffId, setStaffId] = useState(editing.staffId);
  const [customerName, setCustomerName] = useState(editing.entry?.customerName ?? '');
  const [weight, setWeight] = useState(editing.entry ? String(editing.entry.kg).replace('.', ',') : '');
  const { run, busy } = useAction();
  const amount = Number(weight.replace(',', '.'));
  const validWeight = /^\d+(?:[.,]\d{1,2})?$/.test(weight) && amount >= 0.01 && amount <= 10000;
  const eligibleUsers = users?.filter((u) => u.isActive || u.id === editing.staffId);
  const save = async () => {
    if (busy || !date || !customerName.trim() || !validWeight || (isOwner && !users)) return;
    const body = { date, customerName: customerName.trim(), kg: amount, ...(isOwner ? { staffId } : {}) };
    const result = await run(() => editing.entry ? api.patch(`/staff/ironing/${editing.entry.id}`, body) : api.post('/staff/ironing', body), 'Hasil setrika tersimpan');
    if (result) onDone(date);
  };
  return (
    <Sheet open onClose={() => { if (!busy) onClose(); }} title={editing.entry ? 'Ubah hasil setrika' : 'Catat hasil setrika'}>
      <form onSubmit={(e) => { e.preventDefault(); if (!busy) void save(); }}>
        <Field label="Tanggal selesai setrika"><input type="date" className="input" required value={date} disabled={busy} onChange={(e) => setDate(e.target.value)} /></Field>
        {isOwner && (usersError ? <ErrorBox error={usersError} retry={retryUsers} /> : <Field label="Pegawai yang menyetrika"><select className="input" value={staffId} disabled={busy || !users} onChange={(e) => setStaffId(Number(e.target.value))}>{!users ? <option>Memuat pegawai…</option> : eligibleUsers?.map((u) => <option key={u.id} value={u.id}>{u.name}{!u.isActive && ' (nonaktif)'}</option>)}</select></Field>)}
        <Field label="Nama customer"><input className="input" required maxLength={100} autoComplete="off" placeholder="mis. Bu Siti" value={customerName} disabled={busy} onChange={(e) => setCustomerName(e.target.value)} /></Field>
        <Field label="Berat hasil setrika (kg)" hint="Boleh desimal, misalnya 3,5 kg."><input className="input" inputMode="decimal" required placeholder="mis. 3,5" value={weight} disabled={busy} onChange={(e) => setWeight(e.target.value)} /></Field>
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!date || !customerName.trim() || !validWeight || (isOwner && !users)}>Simpan hasil setrika</Button>
      </form>
    </Sheet>
  );
}
