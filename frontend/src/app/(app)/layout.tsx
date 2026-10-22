'use client';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import BottomNav from '@/components/BottomNav';
import { Spinner } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/** Semua halaman di dalam sini wajib login. */
export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) return <Spinner />;
  return (
    <div className="min-h-screen md:pl-28">
      <main className="mx-auto w-full max-w-4xl px-4 pb-32 sm:px-6 md:pb-12">{children}</main>
      <BottomNav />
    </div>
  );
}
