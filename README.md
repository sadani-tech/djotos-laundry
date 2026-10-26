# Djotos Laundry

Aplikasi kasir & pencatatan laundry yang sederhana untuk staff dan owner: order/nota, status + WhatsApp otomatis,
pembayaran Cash/QRIS, cashflow, rekapan customer, bonus staff, dan program **FREE** (9× cuci → 1× gratis).

- **Backend**: NestJS 11 · TypeScript · Prisma 6 · PostgreSQL 16 · Redis + BullMQ · JWT
- **Frontend**: Next.js 15 (App Router) · React 19 · Tailwind CSS 3 — mobile-first, juga nyaman di PC kasir
- Dokumen: [`docs/01-pemahaman-asumsi.md`](docs/01-pemahaman-asumsi.md) (asumsi — **baca dulu**) ·
  [`docs/02-erd-api.md`](docs/02-erd-api.md) (ERD & endpoint) · [`docs/03-cara-uji-per-modul.md`](docs/03-cara-uji-per-modul.md)

## Cara cepat: Docker Compose
```bash
cp .env.example .env        # ubah JWT_SECRET & password
docker compose up --build
```
Buka **http://localhost:3000** — masuk `owner` / `owner123` (ganti segera di *Lainnya → Ganti Password*).
Layanan dari pricelist dan akun owner dibuat otomatis. Untuk data contoh (staff `fani`/`ana`, customer, nota):
`SEED_SAMPLE=true docker compose up --build`.

> `NEXT_PUBLIC_API_URL` ditanam saat build frontend. Jika dipasang di server, ganti ke URL publik API
> (mis. `https://api.domain.com/api`) dan set `CORS_ORIGIN` backend ke alamat frontend.

## Pengembangan lokal
Butuh Node 20+, PostgreSQL 16, Redis 7.
```bash
# Backend
cd backend
cp .env.example .env                 # sesuaikan DATABASE_URL / REDIS_URL
npm install
npx prisma migrate deploy            # buat tabel
npm run seed                         # layanan + owner + data contoh (SEED_SAMPLE=false untuk tanpa contoh)
npm run start:dev                    # http://localhost:4000/api

# Frontend (terminal lain)
cd frontend
cp .env.example .env.local
npm install
npm run dev                          # http://localhost:3000
```

## Konfigurasi (backend `.env`)
| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | koneksi PostgreSQL |
| `REDIS_URL` | Redis untuk antrean WA (BullMQ) |
| `JWT_SECRET` | **wajib** diganti di produksi |
| `CORS_ORIGIN` | alamat frontend (boleh beberapa, pisah koma) |
| `WA_PROVIDER` | `mock` (default, hanya simulasi) · `fonnte` · `wablas` · `cloud` |
| `SEED_OWNER_USERNAME` / `SEED_OWNER_PASSWORD` | akun owner pertama |
| `SEED_SAMPLE` | `true` = buat data contoh bila database masih kosong |

### Konfigurasi gateway WhatsApp
Pilih satu lewat `WA_PROVIDER`, isi variabelnya, restart backend, lalu uji di **Lainnya → Log WhatsApp → Tes**.

| Provider | Variabel | Catatan |
|---|---|---|
| **Fonnte** (`fonnte`) | `FONNTE_TOKEN` | token perangkat dari dashboard Fonnte |
| **Wablas** (`wablas`) | `WABLAS_BASE_URL`, `WABLAS_TOKEN`, `WABLAS_SECRET` | base URL sesuai server akun Wablas |
| **WhatsApp Cloud API** (`cloud`) | `WA_CLOUD_TOKEN`, `WA_CLOUD_PHONE_NUMBER_ID` | pesan teks bebas hanya sampai di customer yang chat dalam 24 jam; di luar itu Meta mewajibkan *template* pesan yang disetujui — untuk laundry, Fonnte/Wablas lebih praktis |

Gateway lain: buat class baru yang mengimplementasi `WaProvider` di `backend/src/wa/providers/` (satu method `send`) lalu daftarkan di `createProvider()` pada `wa.module.ts`.
Pesan masuk antrean; gagal → dicoba ulang 3× (backoff), lalu ditandai *Gagal* dan bisa **Kirim ulang** dari nota atau log. Jeda antar pesan 1,5 detik (`WA_RATE_MS`).

## Deployment

| Lingkungan | Alamat | Catatan |
|---|---|---|
| Web (dev) | https://djotos-laundry.suraise.com | Vercel, root directory `frontend/`, env `NEXT_PUBLIC_API_URL=https://api-djotos-laundry-dev.suraise.com/api` (tipe *Config*, bukan *Secret*; ditanam saat build, jadi wajib redeploy setiap kali diubah) |
| API (dev) | https://api-djotos-laundry-dev.suraise.com/api | VPS SumoPod, container `djotos-api-dev` + `djotos-redis-dev`, DB `djotos_dev` |
| Production | — | belum ada |

Deploy backend: **Actions → "Deploy API Development - Djotos" → Run workflow**
(`.github/workflows/deploy-api-dev.yml`, manual). Alur: build `./backend` → push
ke Docker Hub → SSH ke VPS → `docker compose pull` + `up -d` → tunggu
`GET /api/auth/me` menjawab 401. Frontend ikut Vercel otomatis saat `main` berubah.

Migrasi database dan seed **tidak punya workflow sendiri** — keduanya jalan dari
`CMD` image setiap container start (`prisma migrate deploy` → `prisma/seed.ts`
yang idempotent). Artinya menaikkan versi backend sekaligus menerapkan migrasi.

Dua hal yang mudah terlewat saat menambah alamat baru:

- **`CORS_ORIGIN` adalah daftar origin exact-match.** Menambah domain di Vercel
  tidak otomatis membuat API menerimanya — tambahkan origin-nya di `.env` server
  lalu `docker compose up -d djotos-api-dev` (`docker restart` tidak membaca
  ulang `env_file`). URL *preview* Vercel (berhash) tidak termasuk.
- `NEXT_PUBLIC_API_URL` ikut ter-bake di bundle, jadi ganti env saja tidak cukup
  tanpa redeploy.

Runbook lengkap (termasuk sisa pekerjaan dan utang teknis) ada di workspace ops:
`.others/deployment/ops/RUNBOOK-djotos-dev.md`.

## Tes
```bash
cd backend
npm test            # unit (cepat, tanpa DB)
npm run test:e2e    # e2e: butuh Postgres + Redis; memakai database `djotos_test` & Redis db 1
```
Database test dibuat dengan: `createdb djotos_test` (atau atur `TEST_DATABASE_URL`).

## Ringkasan fitur → di mana
| Kebutuhan | Lokasi di aplikasi |
|---|---|
| Nota, kode layanan (CK, CB, ST, CKX, CBX, STX + satuan) | **Order → Order Baru**; owner mengubah di **Lainnya → Layanan & Harga** |
| Status Diterima → Diproses → Selesai → Diambil, WA otomatis saat Selesai | halaman nota; **Log WhatsApp** |
| Cash + QRIS, penanda BELUM BAYAR, Tandai Lunas | halaman nota, daftar order, rekap customer |
| Cashflow harian/mingguan/bulanan, pembanding Cash vs QRIS, Excel | tab **Cashflow** |
| Rekapan customer + Excel | tab **Customer** |
| Akun staff masing-masing, performa | **Lainnya → Staff & Performa** |
| Bonus staff | **Bonus Saya** / **Bonus Staff** / **Aturan Bonus** |
| FREE 9× cuci → 1× gratis | **Lainnya → Program FREE** |

## Keamanan & operasional (catatan)
- Password disimpan ter-hash (bcrypt); token JWT berlaku 14 hari. Belum ada pembatasan percobaan login — pasang di belakang reverse proxy/WAF bila dibuka ke internet.
- Hapus nota = *soft delete*; semua perubahan status, pembayaran, harga, dan pengaturan tercatat di **Riwayat Perubahan** (audit log).
- Backup: dump database `pg_dump` rutin. Semua data ada di PostgreSQL.
