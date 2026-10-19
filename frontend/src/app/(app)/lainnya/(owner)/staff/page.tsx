'use client';
import { KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';
import { MonthNav } from '@/components/MonthNav';
import { Button, ErrorBox, Field, PageHeader, Segmented, Sheet, Spinner, useAction, useConfirm } from '@/components/ui';
import { api } from '@/lib/api';
import { kg, rupiah } from '@/lib/format';
import { useApi } from '@/lib/swr';
import type { Role, User } from '@/lib/types';

interface Perf { userId: number; name: string; role: Role; orderCount: number; omzet: number; unpaid: number; kg: number }
const currentMonth = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);

export default function StaffPage() {
  const [period, setPeriod] = useState(currentMonth());
  const [adding, setAdding] = useState(false);
  const [resetFor, setResetFor] = useState<User | null>(null);
  const confirm = useConfirm();
  const { run } = useAction();
  const perf = useApi<Perf[]>(`/staff/performance?period=${period}`);
  const users = useApi<User[]>('/users');

  const toggle = async (u: User) => {
    const ok = await confirm({ title: u.isActive ? `Nonaktifkan ${u.name}?` : `Aktifkan ${u.name}?`, confirmText: u.isActive ? 'Ya, nonaktifkan' : 'Ya, aktifkan', danger: u.isActive, message: u.isActive ? 'Akun ini tidak bisa masuk lagi. Riwayat nota tetap tersimpan.' : undefined });
    if (ok && (await run(() => api.patch(`/users/${u.id}`, { isActive: !u.isActive }), 'Tersimpan'))) users.mutate();
  };

  return (
    <div>
      <PageHeader title="Staff & Performa" back="/lainnya" />
      <MonthNav value={period} onChange={setPeriod} />
      <div className="mt-4 space-y-3">
        {perf.error ? <ErrorBox error={perf.error} /> : !perf.data ? <Spinner /> : perf.data.length === 0 ? <p className="text-center text-slate-500">Belum ada data.</p> : perf.data.map((p) => (
          <div key={p.userId} className="card">
            <p className="mb-2 text-lg font-bold">{p.name}</p>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-lg bg-slate-100 p-2"><p className="text-slate-500">Nota</p><p className="font-extrabold">{p.orderCount}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><p className="text-slate-500">Cucian</p><p className="font-extrabold">{kg(p.kg)}</p></div>
              <div className="rounded-lg bg-slate-100 p-2"><p className="text-slate-500">Omzet</p><p className="font-extrabold">{rupiah(p.omzet)}</p></div>
            </div>
            {p.unpaid > 0 && <p className="mt-2 text-sm font-semibold text-red-600">Belum dibayar customer: {rupiah(p.unpaid)}</p>}
          </div>
        ))}
      </div>

      <div className="mb-2 mt-8 flex items-center justify-between">
        <h2 className="text-lg font-bold">Akun</h2>
        <Button size="sm" onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Tambah staff</Button>
      </div>
      <div className="space-y-2">
        {users.data?.map((u) => (
          <div key={u.id} className={`card flex items-center gap-3 p-3 ${u.isActive ? '' : 'opacity-60'}`}>
            <div className="min-w-0 flex-1"><p className="font-bold">{u.name} <span className="text-xs font-semibold text-slate-500">{u.role === 'OWNER' ? 'Owner' : 'Staff'}</span></p><p className="text-sm text-slate-500">@{u.username}{!u.isActive && ' · nonaktif'}</p></div>
            <Button size="sm" variant="secondary" aria-label="Reset password" onClick={() => setResetFor(u)}><KeyRound className="h-4 w-4" /></Button>
            {u.role !== 'OWNER' && <Button size="sm" variant="secondary" onClick={() => toggle(u)}>{u.isActive ? 'Nonaktifkan' : 'Aktifkan'}</Button>}
          </div>
        ))}
      </div>

      <AddStaffSheet open={adding} onClose={() => setAdding(false)} onDone={() => { setAdding(false); users.mutate(); perf.mutate(); }} />
      {resetFor && <ResetSheet user={resetFor} onClose={() => setResetFor(null)} />}
    </div>
  );
}

function AddStaffSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { run, busy } = useAction();
  const [f, setF] = useState({ name: '', username: '', password: '', role: 'STAFF' as Role });
  const save = async () => {
    if (await run(() => api.post('/users', f), 'Akun dibuat')) { setF({ name: '', username: '', password: '', role: 'STAFF' }); onDone(); }
  };
  return (
    <Sheet open={open} onClose={onClose} title="Tambah akun">
      <Field label="Nama"><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="mis. Fani" /></Field>
      <Field label="Username (untuk masuk)"><input className="input" autoCapitalize="none" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} placeholder="mis. fani" /></Field>
      <Field label="Password" hint="Minimal 6 karakter. Beritahu staff, lalu minta ganti sendiri."><input className="input" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
      <Segmented<Role> className="mb-4" value={f.role} onChange={(role) => setF({ ...f, role })} options={[{ value: 'STAFF', label: 'Staff' }, { value: 'OWNER', label: 'Owner' }]} />
      <Button size="lg" className="w-full" loading={busy} disabled={f.name.length < 2 || f.username.length < 3 || f.password.length < 6} onClick={save}>Buat akun</Button>
    </Sheet>
  );
}

function ResetSheet({ user, onClose }: { user: User; onClose: () => void }) {
  const { run, busy } = useAction();
  const [password, setPassword] = useState('');
  const save = async () => { if (await run(() => api.post(`/users/${user.id}/reset-password`, { password }), 'Password diganti')) onClose(); };
  return (
    <Sheet open onClose={onClose} title={`Reset password ${user.name}`}>
      <Field label="Password baru"><input className="input" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Button size="lg" className="w-full" loading={busy} disabled={password.length < 6} onClick={save}>Simpan</Button>
    </Sheet>
  );
}
