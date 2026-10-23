import type { Config } from 'tailwindcss';

/**
 * Design tokens Djotos Laundry, diambil dari logo:
 *  - brand  : biru utama (#0033A0 = brand-600) — tombol utama, navigasi aktif, tautan
 *  - accent : kuning logo (#FFD600 = accent-500) — highlight kecil, penanda terpilih, FREE/promo
 *  - ink / muted / line / surface : teks utama, teks sekunder, garis, latar halaman
 * Warna status tetap konsisten: hijau = lunas, merah = belum bayar, kuning = diproses, biru = selesai.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef3ff', 100: '#dce6ff', 200: '#bccdfa', 300: '#8fa9f0', 400: '#5a7fdb',
          500: '#2b5bc2', 600: '#0033a0', 700: '#002a85', 800: '#00206a', 900: '#00164a',
        },
        accent: {
          50: '#fffbe6', 100: '#fff3b8', 200: '#ffeb85', 300: '#ffe24d', 400: '#ffdc1f',
          500: '#ffd600', 600: '#e6bf00', 700: '#a37f00', 800: '#6b5300', 900: '#4a3a00',
        },
        ink: '#172033',
        muted: '#64748b',
        line: '#e5eaf2',
        surface: '#f7f9fc',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans Variable"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(23, 32, 51, 0.05)',
        pop: '0 8px 24px rgba(23, 32, 51, 0.12)',
      },
      borderRadius: { card: '1rem' },
    },
  },
  plugins: [],
};
export default config;
