import type { Config } from 'tailwindcss';

// Warna status konsisten di seluruh aplikasi:
// hijau = lunas, merah = belum bayar, kuning = diproses, biru = selesai. Warna merek = ungu (tidak bentrok).
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#f5f3ff', 100: '#ede9fe', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9' },
      },
      fontFamily: { sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
