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
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-5 py-10">
      <div className="mb-8 text-center">
        {/* Logo asli, proporsi tidak diubah */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/djotos-logo-640.png" alt="Djotos Laundry" width={640} height={707} className="mx-auto h-auto w-44 sm:w-52" />
        <h1 className="sr-only">Djotos Laundry</h1>
      </div>
      <form onSubmit={submit} className="card w-full max-w-sm p-6 sm:p-8">
        <p className="mb-6 text-center text-lg font-bold">Silakan masuk</p>
        <Field label="Username">
          <input className="input" autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="contoh: fani" required />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">Masuk</Button>
      </form>
      <p className="mt-8 text-sm text-muted">Djotos Laundry</p>
    </main>
  );
}
