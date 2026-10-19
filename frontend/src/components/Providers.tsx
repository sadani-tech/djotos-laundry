'use client';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/auth';
import { UiProvider } from './ui';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <UiProvider>{children}</UiProvider>
    </AuthProvider>
  );
}
