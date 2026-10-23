'use client';
import { Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button, Field, LogoMark, useAction } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const { run, busy } = useAction();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await run(() => login(username, password).then(() => true));
    if (ok) router.replace('/');
  };

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-2xl shadow-slate-900/10 md:grid-cols-[1.05fr_1fr]">
        <section className="relative hidden overflow-hidden bg-brand-700 p-10 text-white md:flex md:flex-col md:justify-between">
          <div className="relative flex items-center gap-3">
            <LogoMark size="lg" />
            <span className="text-lg font-extrabold tracking-tight">Djotos Laundry</span>
          </div>
          <div className="relative">
            <p className="mb-3 text-sm font-semibold text-brand-200">Lebih rapi, lebih cepat</p>
            <h2 className="max-w-sm text-4xl font-extrabold leading-tight tracking-tight">Kelola laundry dalam satu tempat.</h2>
            <p className="mt-4 max-w-sm leading-relaxed text-brand-100">Pantau order, pembayaran, pelanggan, dan progres cucian dengan alur yang sederhana.</p>
          </div>
          <div className="relative flex items-center gap-2 text-sm font-semibold text-brand-100"><ShieldCheck className="h-5 w-5" /> Data operasional tersimpan aman</div>
        </section>

        <form onSubmit={submit} className="p-6 sm:p-10 md:p-12">
          <div className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/djotos-logo-640.png" alt="Djotos Laundry" width={640} height={707} className="mx-auto mb-6 h-auto w-40 md:hidden" />
            <p className="eyebrow">Selamat datang</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-950">Masuk ke akun</h1>
            <p className="mt-2 text-slate-500">Gunakan akun staf atau owner Djotos Laundry.</p>
          </div>
          <Field label="Username">
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
              <input className="input pl-11" autoCapitalize="none" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Masukkan username" required autoFocus />
            </div>
          </Field>
          <Field label="Password">
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
              <input className="input px-11" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan password" required />
              <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'} className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </Field>
          <Button type="submit" size="lg" loading={busy} className="mt-2 w-full rounded-2xl">Masuk</Button>
          <p className="mt-6 text-center text-xs leading-relaxed text-slate-400">Akses khusus tim Djotos Laundry.<br />Hubungi owner jika lupa akun.</p>
        </form>
      </div>
    </main>
  );
}
