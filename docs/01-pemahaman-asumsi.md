# 1. Ringkasan Pemahaman & Asumsi

## Bahan referensi yang benar-benar saya terima
| Bahan | Isi | Dipakai untuk |
|---|---|---|
| `Daftar_Harga_Djotos_Laundry.pdf` | Tabel harga Reguler & Express (3–20 kg) + harga satuan | Master data layanan (seeder) |
| Foto buku "September" | Catatan harian: nama, berat, kode, harga, 2 kolom centang | Format cashflow & rekapan, tanda belum bayar, "free 3kg" |
| Foto buku target staff | Tanggal, hari, nama staff, target (kg), rincian `Nama (kg)` | Rekap harian staff & dasar bonus per kg |

> **Excel cashflow & rekapan tidak ikut terlampir** (yang masuk hanya PDF pricelist + 2 foto). Format laporan dan
> export Excel saya buat mengikuti kolom di foto buku catatan. Kalau nanti Excel aslinya dikirim, tinggal
> disesuaikan di `backend/src/reports/excel.service.ts`.

## Temuan dari pricelist
- Nama di pricelist "Cuci Seterika" = **CK (Cuci Kering)**; "Seterika" = **ST**; "Cuci Basah" = **CB**. Versi Express = **CKX / STX / CBX**.
- Tarif per kg: CK 5.000 · ST 4.000 · CB 3.000 · CKX 7.000 · STX 6.000 · CBX 4.000.
- **Ada minimum kg**: Reguler min 3 kg; Express CKX & STX min 2 kg, CBX min 3 kg.
- **Anomali CK 3 kg = Rp 16.000** (bukan 15.000). Ini sama dengan yang tertulis di buku (`Ranto 3 CK 16.000`).
  Dimodelkan sebagai `harga minimum` per layanan, bukan hardcode.
- Satuan (pcs): SPK 8.000, SPB 10.000, SSK 10.000, SSB 15.000, BDK 20.000, BDB 25.000, BDJ 35.000.
- Di atas 20 kg (tabel berhenti di 20) tetap memakai tarif per kg yang sama.

## Rumus harga
```
qty ditagih = max(qty, minQty)
harga       = max(qty ditagih × tarif, minPrice ?? 0)      (dibulatkan ke rupiah)
```
Semua angka (tarif, minimum, minPrice) bisa diedit owner di menu **Layanan & Harga**.

## Asumsi (silakan koreksi)
1. **Dua kolom centang di buku** = Cash dan QRIS. Baris tanpa centang = **Belum Bayar**.
2. **Zona waktu WIB (UTC+7)** untuk "hari ini", laporan harian/mingguan/bulanan. Minggu dimulai **Senin**.
3. **Alur status**: Diterima → Diproses → Selesai → Diambil. Status boleh mundur satu langkah oleh owner saja. Batal = status tersendiri (CANCELLED).
4. **WA otomatis** terkirim saat status berubah ke **Selesai**. Jika customer tidak punya nomor WA, log dicatat "Gagal: nomor kosong".
5. **FREE (loyalty)**
   - Yang dihitung: nota yang **lunas**, **tidak dibatalkan/dihapus**, bukan nota FREE, dan mengandung layanan yang bertanda "Dihitung FREE" (default: CK, CB, CKX, CBX).
   - Ambang default **9** nota → hak 1× gratis (nota ke-10). Ambang bisa diubah di Pengaturan.
   - **Isi gratis = 3 kg** (default, diubah di Pengaturan) — mengikuti buku (`free 3kg`, `Mida 4 CK free 3kg Rp 5.000`). Bila berat melebihi 3 kg, **kelebihannya ditagih normal**. Layanan & berat dipilih saat klaim.
   - Klaim "memakai" 9 nota tertua yang memenuhi syarat; jika customer punya lebih dari 9, **sisanya tetap tersimpan** (bukan hangus). Normalnya sisa = 0 sehingga counter kembali 0.
   - Nota yang sudah dipakai klaim tidak bisa dibatalkan/dihapus.
6. **Pembayaran**: boleh dicicil, tiap pembayaran punya metode sendiri (Cash/QRIS) sehingga satu nota bisa campuran. Status: Belum Bayar / Sebagian / Lunas. Nota FREE bernilai Rp 0 otomatis Lunas.
7. **Cashflow**: pemasukan dihitung **berdasar tanggal pembayaran diterima** (bukan tanggal nota). Pengeluaran punya metode (default Cash) sehingga bisa dihitung **kas bersih Cash**.
8. **Bonus staff** (default, semua bisa diubah di Pengaturan → Aturan Bonus):
   - Bonus per kg: **Rp 200/kg**, aktif bila total kg bulan itu ≥ **500 kg**.
   - Bonus omzet: **1%**, aktif bila omzet bulan itu ≥ **Rp 5.000.000**.
   - Omzet/kg dihitung dari nota **lunas, tidak batal, bukan FREE** yang dibuat staff tsb pada bulan tersebut; hanya layanan berunit kg dihitung ke "kg".
   - Aturan yang aktif dijumlahkan. Owner dapat "Simpan Rekap Bulan" lalu menandai "Sudah Dibayar".
9. **Hapus nota** = soft delete (hanya owner), tetap ada di audit log. Staff hanya bisa membatalkan nota yang belum dibayar.
10. **Staff hanya melihat** nota & rekap yang ia buat sendiri; **Owner melihat semua**. Daftar customer dan layanan dipakai bersama.
11. **Nota cetak**: halaman siap print thermal 58 mm + tombol Bagikan (WhatsApp / share HP). PDF = "Simpan sebagai PDF" dari dialog cetak browser (tanpa library PDF server).
12. **WA gateway**: provider dipilih lewat env `WA_PROVIDER` (`mock` default, `fonnte`, `wablas`, `cloud`). Mode `mock` hanya menulis log — aman untuk uji coba.
13. Nomor telepon dinormalisasi ke format `62xxxxxxxxxx`.
14. Satu customer = satu nomor WA unik (kalau kosong dibolehkan, mis. pelanggan lepas).

## Pertanyaan terbuka (tidak menghalangi, ada default)
- Apakah CB (cuci basah saja) memang dihitung FREE? *(default: ya)*
- Apakah free 3 kg berlaku untuk semua layanan cuci termasuk Express? *(default: ya, bisa dipilih saat klaim)*
- Nilai bonus per kg / persen omzet yang sebenarnya? *(default di atas hanya contoh)*
- Apakah kolom centang kedua di buku betul QRIS/transfer?

## Pilihan stack
Sesuai permintaan: **NestJS + Prisma + PostgreSQL + Redis/BullMQ** (backend), **Next.js 15 + Tailwind** (frontend).
Tidak memakai library chart: grafik pembanding Cash vs QRIS digambar dengan bar/donut SVG sederhana agar ringan di HP murah.
