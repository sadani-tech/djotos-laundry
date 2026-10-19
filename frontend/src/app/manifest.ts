import type { MetadataRoute } from 'next';

// Supaya bisa "Tambahkan ke Layar Utama" di HP dan terasa seperti aplikasi.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Djotos Laundry',
    short_name: 'Djotos',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#7c3aed',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
