import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import Providers from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Djotos Laundry',
  description: 'Aplikasi kasir dan pencatatan laundry',
  applicationName: 'Djotos Laundry',
  appleWebApp: { capable: true, title: 'Djotos Laundry', statusBarStyle: 'default' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f8fafc' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
