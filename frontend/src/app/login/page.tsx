'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Field, useAction } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const { run, busy } = useAction();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() => login(username, password).then(() => true));
    if (ok) router.replace('/');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4">
      <form onSubmit={submit} className="card w-full max-w-sm space-y-2 p-6">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 text-3xl">🧺</div>
          <h1 className="text-2xl font-extrabold text-brand-700">Djotos Laundry</h1>
          <p className="text-slate-500">Silakan masuk</p>
        </div>
        <Field label="Username">
          <input className="input" autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="contoh: fani" required />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button type="submit" size="lg" loading={busy} className="w-full">Masuk</Button>
      </form>
    </main>
  );
}
