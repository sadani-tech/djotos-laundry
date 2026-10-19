# 2. ERD & Daftar Endpoint

## ERD
```mermaid
erDiagram
  users ||--o{ orders : "menerima (staffId)"
  users ||--o{ payments : "menerima bayar"
  users ||--o{ expenses : "mencatat"
  users ||--o{ bonus_records : "punya"
  users ||--o{ audit_logs : "pelaku"
  customers ||--o{ orders : "punya"
  customers ||--o{ free_claims : "klaim"
  customers ||--o{ wa_logs : "dikirimi"
  services ||--o{ order_items : "dipakai"
  orders ||--|{ order_items : "berisi"
  orders ||--o{ payments : "dibayar"
  orders ||--o{ wa_logs : "notifikasi"
  free_claims ||--o{ orders : "memakai nota (freeClaimId)"
  free_claims ||--|| orders : "nota FREE (orderId)"

  users { int id PK  string username UK  string name  enum role  bool isActive  string passwordHash }
  customers { int id PK  string name  string phone UK  string address  datetime deletedAt }
  services { int id PK  string code UK  string name  enum category  enum unit  int rate  decimal minQty  int minPrice  int durationHours  bool countsForFree  bool isActive }
  orders { int id PK  string invoiceNo UK  int customerId FK  int staffId FK  enum status  int subtotal  int discount  int total  int paidAmount  enum paymentStatus  bool isFree  bool countsForFree  int freeClaimId FK  datetime receivedAt  datetime estimatedAt  datetime finishedAt  datetime pickedUpAt  datetime deletedAt }
  order_items { int id PK  int orderId FK  int serviceId FK  string code  string name  enum unit  decimal qty  int unitPrice  int subtotal }
  payments { int id PK  int orderId FK  enum method  int amount  datetime paidAt  int receivedById FK  datetime voidedAt }
  expenses { int id PK  string category  string description  int amount  enum method  datetime spentAt  int createdById FK  datetime deletedAt }
  free_claims { int id PK  int customerId FK  int orderId FK  int claimedById FK  datetime claimedAt }
  bonus_rules { int id PK  string name  enum type  decimal value  int minTarget  bool isActive }
  bonus_records { int id PK  int userId FK  string period  int orderCount  decimal totalKg  int omzet  int amount  json breakdown  enum status  datetime paidAt }
  wa_logs { int id PK  int orderId FK  int customerId FK  string phone  string message  enum type  enum status  int attempts  string error  datetime sentAt }
  settings { string key PK  json value }
  sequences { string key PK  int value }
  audit_logs { int id PK  int userId FK  string action  string entity  int entityId  json before  json after  datetime createdAt }
```

## Endpoint (prefix `/api`, JWT kecuali login; **O** = hanya Owner)
| Modul | Method & path | Keterangan |
|---|---|---|
| Auth | `POST /auth/login` | username + password → token |
| | `GET /auth/me` · `POST /auth/change-password` | |
| Staff | `GET /users` **O** · `POST /users` **O** · `PATCH /users/:id` **O** · `POST /users/:id/reset-password` **O** | |
| Layanan | `GET /services` (`?all=1` O) · `POST /services` **O** · `PATCH /services/:id` **O** | |
| Customer | `GET /customers?q&unpaid&sort` · `POST` · `GET /:id` · `PATCH /:id` · `DELETE /:id` **O** | rekap + progres FREE |
| | `GET /customers/export` | Excel rekapan |
| Order | `GET /orders?date&status&payment&q&mine` · `POST /orders` · `GET /orders/:id` | |
| | `PATCH /orders/:id/status` `{status}` | Selesai → WA otomatis |
| | `PATCH /orders/:id` (catatan/diskon) · `POST /orders/:id/cancel` · `DELETE /orders/:id` **O** | |
| Bayar | `POST /orders/:id/payments` `{method, amount}` · `POST /orders/:id/pay-full` `{method}` | Tandai Lunas |
| | `DELETE /payments/:id` **O** | void pembayaran |
| Dashboard | `GET /dashboard` | 4 angka utama + Cash/QRIS hari ini |
| Cashflow | `GET /cashflow/summary?period=day\|week\|month&date` | masuk, keluar, bersih, Cash vs QRIS, per hari |
| | `GET /cashflow/transactions?period&date` | daftar harian seperti buku |
| | `GET /cashflow/export?period&date` | Excel |
| | `GET/POST /expenses` · `PATCH/DELETE /expenses/:id` | pengeluaran |
| FREE | `GET /free` | progres semua customer + yang berhak klaim |
| | `POST /free/claim` `{customerId, serviceId, qty}` | buat nota FREE |
| | `GET /free/claims` | riwayat klaim |
| Bonus | `GET /bonus/rules` · `PUT /bonus/rules` **O** | aturan |
| | `GET /bonus/me?period=YYYY-MM` | Bonus Saya |
| | `GET /bonus/summary?period` **O** · `POST /bonus/records/generate` **O** · `PATCH /bonus/records/:id/pay` **O** | |
| Staff perf | `GET /staff/performance?period` **O** · `GET /staff/daily-recap?date` | omzet, nota, kg · rincian harian |
| WA | `GET /wa/logs` · `POST /wa/logs/:id/resend` · `POST /wa/test` **O** · `GET /wa/status` | |
| Pengaturan | `GET /settings` · `PUT /settings` **O** | template WA, toko, FREE |
| Audit | `GET /audit` **O** | riwayat perubahan |
