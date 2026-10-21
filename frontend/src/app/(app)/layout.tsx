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
    <div className="min-h-screen md:pl-24">
      <main className="mx-auto max-w-2xl px-5 pb-36 sm:px-6 md:max-w-3xl md:pb-16">{children}</main>
      <BottomNav />
    </div>
  );
}
