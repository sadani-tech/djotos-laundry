# 3. Cara Menguji Tiap Modul

Prasyarat: stack berjalan (lihat README) dan seeder sudah dijalankan.
Akun: **owner / owner123** (Owner), **fani / staff123** dan **ana / staff123** (Staff).
Tes otomatis: `cd backend && npm run test:all` (20 unit + 63 e2e, memakai database `djotos_test`).

| # | Modul | Uji manual (UI) | Tes otomatis (grup di `backend/test/app.e2e-spec.ts`) |
|---|---|---|---|
| 1 | **Auth & Staff** | Masuk sebagai Fani → **Lainnya**: menu Owner tidak tampil. Masuk Owner → **Lainnya → Staff & Performa → Tambah staff**, lalu coba masuk dengan akun baru. Nonaktifkan akun → tidak bisa masuk. **Staff & Performa** menampilkan kg Cuci dan kg Setrika per staff (CK/CKX masuk keduanya) (atur jenis kerja di **Layanan & Harga**). | `Auth & Staff` |
| 2 | **Layanan & Order** | **Order → Order Baru**: pilih customer → ketuk **CK** → pilih **3 kg** → total **Rp 16.000** (bukan 15.000). 4 kg = 20.000. Coba **CKX** 5 kg = 35.000, **SPK** 2 pcs = 16.000. Owner: **Layanan & Harga** → ubah tarif / tambah layanan, order baru memakai harga baru. | `Layanan & Order` |
| 3 | **Pembayaran** | Buka nota → **Bayar sebagian…** (Cash 10.000) → badge **KURANG Rp x**; lalu **Lunas QRIS** → **LUNAS**. Filter **Belum Bayar** di beranda hanya memuat yang belum lunas. Owner bisa membatalkan pembayaran (ikon tempat sampah). | `Pembayaran`, `Batal & hapus nota` |
| 4 | **Status & WA otomatis** | Di nota ketuk **Mulai Proses → Tandai Selesai** (ada konfirmasi). Bagian **Pesan WhatsApp** berubah ke *Terkirim*. Detail pada **Lainnya → Log WhatsApp** (mode `mock` = simulasi). Matikan WA otomatis / edit template di **Pengaturan**. | `Status order & WhatsApp otomatis` |
| 5 | **Cashflow** | Tab **Cashflow**: Harian / Mingguan / Bulanan, panah ganti tanggal. Lihat kartu **Cash vs QRIS** (donat + %), grafik per hari (mingguan/bulanan), **+ Pengeluaran**, tombol **Excel**. Staff hanya melihat kas miliknya; Owner bisa filter per staff. | `Cashflow` |
| 6 | **Customer & rekapan** | Tab **Customer**: cari, filter **Belum Bayar**, urutkan, **Excel**. Ketuk customer → riwayat semua nota, total belanja, tagihan, progres FREE. | `Customer & rekapan` |
| 7 | **FREE** (menu: Lainnya → Program FREE) | Seed membuat **Nida 9/9** (siap klaim) dan **Bu Win 8/9**. Tab **FREE** → **Klaim FREE** (pilih CK, 3 kg) → nota Rp 0 bertanda FREE. Coba 4 kg → bayar Rp 5.000. Lunasi 1 nota cuci Bu Win → 9/9 dan muncul di "Siap klaim" (tanpa WA ke customer). Customer dengan 20 nota → "2× FREE tersedia", klaim dua kali berturut-turut; klaim ketiga ditolak. | `Menu FREE` |
| 8 | **Bonus** | **Lainnya → Bonus Saya** (staff) melihat bonus + progres target. Owner: **Aturan Bonus** (ubah nilai/target), **Bonus Staff → Simpan rekap bulan ini → Tandai sudah dibayar** (angka dibekukan). **Rekap Harian Staff** meniru buku target. | `Staff & Bonus` |
| 9 | **WA gateway nyata** | Isi token di `.env`, set `WA_PROVIDER`, restart backend, **Log WhatsApp → Tes** ke nomor sendiri. | unit test template + `Status order & WhatsApp otomatis` (retry & kirim ulang) |

## Mencoba kegagalan WA
Set `WA_PROVIDER=fonnte` tanpa token → pesan gagal dengan alasan jelas ("FONNTE_TOKEN belum diisi"), BullMQ mencoba ulang 3× (backoff 5 dtk, 10 dtk), lalu status **Gagal** + tombol **Kirim ulang**.

## Hasil Setrika Harian dari Pesanan
1. Buat nota untuk layanan Setrika atau Cuci + Setrika. Layanan cuci saja tidak masuk rekap setrika.
2. Ubah status mengikuti tahap pada nota: Cuci (jika ada), Setrika, lalu Selesai.
3. Staff yang mengubah status dari Setrika ke Selesai tercatat sebagai penyelesai. Rekap menampilkan total per staff, total per customer, dan tautan ke nota asal.
4. Staff hanya melihat hasil yang diselesaikannya; Owner melihat semua staff. Tidak ada input hasil setrika di luar nota.
5. Nota yang belum selesai tahap setrikanya tidak masuk rekap. Setiap nota dihitung sekali berdasarkan penyelesaian terakhirnya.

Verifikasi perubahan: backend build, 20 unit test dan 67 e2e test lulus di PostgreSQL/Redis lokal terisolasi; frontend typecheck dan production build lulus. Uji browser mencakup tambah/ubah/hapus, desimal koma, owner memilih pegawai, filter tanggal, isolasi data staff, serta lebar 320/390/1440 px tanpa overflow horizontal. Migrasi setrika lama diarsipkan saat deploy; rekap baru hanya membaca penyelesaian tahap Setrika dari nota.
