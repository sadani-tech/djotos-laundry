'use client';
import type { ReactNode } from 'react';
import { Empty, PageHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { Lock } from 'lucide-react';

/** Halaman Owner: staff diblokir di sini sebelum sempat memanggil API. */
export default function OwnerLayout({ children }: { children: ReactNode }) {
  const { isOwner } = useAuth();
  if (!isOwner) {
    return (
      <>
        <PageHeader title="Khusus Owner" back="/lainnya" />
        <Empty icon={<Lock className="h-12 w-12" />} title="Halaman ini hanya untuk Owner" hint="Hubungi owner jika Anda perlu mengubah data atau pengaturan." />
      </>
    );
  }
  return <>{children}</>;
}
