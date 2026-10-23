import type { MetadataRoute } from 'next';

// Supaya bisa "Tambahkan ke Layar Utama" di HP dan terasa seperti aplikasi.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Djotos Laundry',
    short_name: 'Djotos',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F9FC',
    theme_color: '#0033A0',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
