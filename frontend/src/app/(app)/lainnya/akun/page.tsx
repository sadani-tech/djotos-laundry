'use client';
import { useState } from 'react';
import { Button, Field, PageHeader, useAction } from '@/components/ui';
import { api } from '@/lib/api';

export default function AccountPage() {
  const { run, busy } = useAction();
  const [oldPassword, setOld] = useState('');
  const [newPassword, setNew] = useState('');
  const save = async () => { if (await run(() => api.post('/auth/change-password', { oldPassword, newPassword }), 'Password berhasil diganti')) { setOld(''); setNew(''); } };
  return (
    <div>
      <PageHeader title="Ganti Password" back="/lainnya" />
      <div className="card">
        <Field label="Password lama"><input className="input" type="password" value={oldPassword} onChange={(e) => setOld(e.target.value)} autoComplete="current-password" /></Field>
        <Field label="Password baru" hint="Minimal 6 karakter."><input className="input" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} autoComplete="new-password" /></Field>
        <Button size="lg" className="w-full" loading={busy} disabled={!oldPassword || newPassword.length < 6} onClick={save}>Simpan password</Button>
      </div>
    </div>
  );
}
