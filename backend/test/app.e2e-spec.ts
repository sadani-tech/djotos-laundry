import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/common/prisma.service';
import { WA_PROVIDER, WaProvider } from '../src/wa/providers/wa-provider';
import { Api, createApp, login, makeApi, waitFor } from './helpers';

/**
 * Alur bisnis utama, berurutan: Auth & Staff → Layanan & Order → Pembayaran → Cashflow →
 * Customer → FREE → Bonus → WA. Semua data dibuat lewat API (database test kosong + seed layanan/owner).
 */
describe('Djotos Laundry API', () => {
  let app: INestApplication;
  let owner: Api, fani: Api, ana: Api;
  let svc: Record<string, number>;
  const ids: Record<string, number> = {};

  beforeAll(async () => {
    app = await createApp();
    const o = await login(app, 'owner', 'owner123');
    owner = makeApi(app, o.token);
  });
  afterAll(async () => {
    await app.close();
  });

  // ------------------------------------------------------------------ 1. Auth & Staff
  describe('Auth & Staff', () => {
    it('login salah ditolak dengan pesan ramah', async () => {
      const r = await login(app, 'owner', 'salah');
      expect(r.status).toBe(401);
      expect(r.body.message).toBe('Username atau password salah');
    });

    it('tanpa token → 401', async () => {
      await makeApi(app).get('/orders').expect(401);
    });

    it('owner membuat 2 akun staff; username duplikat ditolak', async () => {
      await owner.post('/users', { name: 'Fani', username: 'Fani', password: 'staff123' }).expect(201);
      await owner.post('/users', { name: 'Ana', username: 'ana', password: 'staff123' }).expect(201);
      const dup = await owner.post('/users', { name: 'Fani 2', username: 'fani', password: 'staff123' }).expect(400);
      expect(dup.body.message).toMatch(/sudah dipakai/);
      fani = makeApi(app, (await login(app, 'fani', 'staff123')).token);
      ana = makeApi(app, (await login(app, 'ana', 'staff123')).token);
    });

    it('staff tidak boleh membuka menu owner', async () => {
      const r = await fani.get('/users').expect(403);
      expect(r.body.message).toBe('Menu ini hanya untuk Owner');
      await fani.put('/settings', {}).expect(403);
      await fani.get('/audit').expect(403);
    });

    it('akun nonaktif tidak bisa masuk', async () => {
      const u = await owner.post('/users', { name: 'Temp', username: 'temp', password: 'rahasia1' }).expect(201);
      await owner.patch(`/users/${u.body.id}`, { isActive: false }).expect(200);
      expect((await login(app, 'temp', 'rahasia1')).status).toBe(401);
    });

    it('validasi input memberi pesan satu kalimat', async () => {
      const r = await owner.post('/users', { name: 'X', username: 'x y', password: '1' }).expect(400);
      expect(typeof r.body.message).toBe('string');
    });
  });

  // ------------------------------------------------------------------ 2. Layanan & Order
  describe('Layanan & Order', () => {
    it('seed layanan dari pricelist: 13 layanan aktif', async () => {
      const r = await fani.get('/services').expect(200);
      expect(r.body).toHaveLength(13);
      svc = Object.fromEntries(r.body.map((s: any) => [s.code, s.id]));
      expect(Object.keys(svc)).toEqual(expect.arrayContaining(['CK', 'CB', 'ST', 'CKX', 'CBX', 'STX', 'SPK', 'BDJ']));
      expect(r.body[0]).not.toHaveProperty('durationHours'); // estimasi jam sudah dihapus dari layanan
    });

    it('jenis kerja layanan: CB/CBX cuci, ST/STX setrika, CK/CKX cuci+setrika, satuan lainnya', async () => {
      const r = (await fani.get('/services').expect(200)).body;
      const w = Object.fromEntries(r.map((x: any) => [x.code, x.workType]));
      expect(w).toMatchObject({ CB: 'WASH', CBX: 'WASH', ST: 'IRON', STX: 'IRON', CK: 'WASH_IRON', CKX: 'WASH_IRON', SPK: 'OTHER', BDJ: 'OTHER' });
    });

    it('customer: nomor dinormalisasi, duplikat & tidak valid ditolak', async () => {
      const c = await fani.post('/customers', { name: 'Bu Win', phone: '0812-3456-7001' }).expect(201);
      expect(c.body.phone).toBe('6281234567001');
      ids.win = c.body.id;
      await fani.post('/customers', { name: 'Orang Lain', phone: '081234567001' }).expect(400);
      await fani.post('/customers', { name: 'Salah', phone: '12' }).expect(400);
      ids.nida = (await fani.post('/customers', { name: 'Nida', phone: '081234567002' }).expect(201)).body.id;
      ids.nophone = (await fani.post('/customers', { name: 'Tanpa WA' }).expect(201)).body.id;
    });

    it('nota CK 3 kg = Rp 16.000, nomor nota DJ-YYMMDD-001, tercatat atas nama staff', async () => {
      const r = await fani.post('/orders', { customerId: ids.win, items: [{ serviceId: svc.CK, qty: 3 }] }).expect(201);
      expect(r.body.total).toBe(16000);
      expect(r.body.invoiceNo).toMatch(/^DJ-\d{6}-001$/);
      expect(r.body.staff.name).toBe('Fani');
      expect(r.body.paymentStatus).toBe('UNPAID');
      expect(r.body.status).toBe('RECEIVED');
      expect(r.body).not.toHaveProperty('estimatedAt'); // estimasi jam sudah dihapus
      ids.o1 = r.body.id;
    });

    it('campur layanan + diskon; nomor nota berikutnya 002', async () => {
      const r = await ana.post('/orders', {
        customerId: ids.win,
        items: [{ serviceId: svc.CKX, qty: 5 }, { serviceId: svc.SPK, qty: 2 }],
        discount: 1000,
        note: 'sprei bernoda',
      }).expect(201);
      expect(r.body.subtotal).toBe(35000 + 16000);
      expect(r.body.total).toBe(50000);
      expect(r.body.invoiceNo).toMatch(/-002$/);
      expect(r.body.summary).toBe('CKX 5kg, SPK 2pcs');
      ids.o2 = r.body.id;
    });

    it('validasi: tanpa layanan, kg nol, pcs pecahan, layanan nonaktif', async () => {
      await fani.post('/orders', { customerId: ids.win, items: [] }).expect(400);
      await fani.post('/orders', { customerId: ids.win, items: [{ serviceId: svc.CK, qty: 0 }] }).expect(400);
      const frac = await fani.post('/orders', { customerId: ids.win, items: [{ serviceId: svc.SPK, qty: 1.5 }] }).expect(400);
      expect(frac.body.message).toMatch(/bilangan bulat/);
      await owner.patch(`/services/${svc.BDJ}`, { isActive: false }).expect(200);
      await fani.post('/orders', { customerId: ids.win, items: [{ serviceId: svc.BDJ, qty: 1 }] }).expect(400);
      expect((await fani.get('/services')).body).toHaveLength(12);
      expect((await owner.get('/services?all=1')).body).toHaveLength(13);
      await owner.patch(`/services/${svc.BDJ}`, { isActive: true }).expect(200);
    });

    it('owner mengubah harga layanan tanpa coding → nota baru pakai harga baru, nota lama tetap', async () => {
      await owner.patch(`/services/${svc.CB}`, { rate: 3500 }).expect(200);
      const r = await fani.post('/orders', { customerId: ids.nida, items: [{ serviceId: svc.CB, qty: 4 }] }).expect(201);
      expect(r.body.total).toBe(14000);
      await fani.post('/orders/' + r.body.id + '/cancel').expect(201);
      await owner.patch(`/services/${svc.CB}`, { rate: 3000 }).expect(200);
      const old = await fani.get(`/orders/${ids.o1}`).expect(200);
      expect(old.body.total).toBe(16000);
    });

    it('layanan baru bisa ditambah owner; staff tidak boleh', async () => {
      await fani.post('/services', { code: 'GRD', name: 'Gordyn', category: 'SATUAN', unit: 'PCS', rate: 30000 }).expect(403);
      const r = await owner.post('/services', { code: 'grd', name: 'Gordyn', category: 'SATUAN', unit: 'PCS', rate: 30000 }).expect(201);
      expect(r.body.code).toBe('GRD');
      await owner.post('/services', { code: 'GRD', name: 'Lagi', category: 'SATUAN', unit: 'PCS', rate: 1 }).expect(400);
    });
  });

  // ------------------------------------------------------------------ 3. Pembayaran
  describe('Pembayaran', () => {
    it('bayar sebagian Cash → SEBAGIAN; melebihi sisa ditolak', async () => {
      const r = await fani.post(`/orders/${ids.o2}/payments`, { method: 'CASH', amount: 20000 }).expect(201);
      expect(r.body.paymentStatus).toBe('PARTIAL');
      expect(r.body.paidAmount).toBe(20000);
      expect(r.body.balance).toBe(30000);
      const over = await fani.post(`/orders/${ids.o2}/payments`, { method: 'QRIS', amount: 99000 }).expect(400);
      expect(over.body.message).toMatch(/melebihi sisa tagihan/);
    });

    it('Tandai Lunas dengan QRIS melunasi sisa → LUNAS (campuran Cash + QRIS)', async () => {
      const r = await ana.post(`/orders/${ids.o2}/pay-full`, { method: 'QRIS' }).expect(201);
      expect(r.body.paymentStatus).toBe('PAID');
      expect(r.body.payments.map((p: any) => [p.method, p.amount])).toEqual([['CASH', 20000], ['QRIS', 30000]]);
      await ana.post(`/orders/${ids.o2}/pay-full`, { method: 'CASH' }).expect(400); // sudah lunas
    });

    it('filter "Belum Bayar" hanya memuat nota belum lunas', async () => {
      const r = await fani.get('/orders?payment=unpaid').expect(200);
      expect(r.body.map((o: any) => o.id)).toContain(ids.o1);
      expect(r.body.map((o: any) => o.id)).not.toContain(ids.o2);
      expect(r.body.every((o: any) => o.paymentStatus !== 'PAID')).toBe(true);
    });

    it('bayar langsung saat input nota (Cash, lunas)', async () => {
      const r = await fani.post('/orders', { customerId: ids.nida, items: [{ serviceId: svc.CK, qty: 5 }], payment: { method: 'CASH' } }).expect(201);
      expect(r.body.paymentStatus).toBe('PAID');
      expect(r.body.paidAmount).toBe(25000);
      ids.o3 = r.body.id;
    });

    it('void pembayaran hanya owner dan mengembalikan status', async () => {
      const o = (await fani.get(`/orders/${ids.o3}`)).body;
      await fani.del(`/payments/${o.payments[0].id}`).expect(403);
      const r = await owner.del(`/payments/${o.payments[0].id}`).expect(200);
      expect(r.body.paymentStatus).toBe('UNPAID');
      await fani.post(`/orders/${ids.o3}/pay-full`, { method: 'QRIS' }).expect(201);
    });
  });

  // ------------------------------------------------------------------ 4. Status & WA otomatis
  describe('Status order & WhatsApp otomatis', () => {
    it('alur Diterima → Diproses → Selesai → Diambil', async () => {
      expect((await fani.patch(`/orders/${ids.o2}/status`, { status: 'PROCESSING' }).expect(200)).body.status).toBe('PROCESSING');
      const fin = await fani.patch(`/orders/${ids.o2}/status`, { status: 'FINISHED' }).expect(200);
      expect(fin.body.finishedAt).toBeTruthy();
    });

    it('status Selesai otomatis membuat & mengirim WA (via antrean), isi pesan benar', async () => {
      const log = await waitFor(async () => {
        const r = await fani.get(`/wa/logs?orderId=${ids.o2}`);
        const l = r.body.find((x: any) => x.type === 'FINISHED');
        return l?.status === 'SENT' ? l : undefined;
      });
      expect(log.phone).toBe('6281234567001');
      expect(log.message).toContain('Bu Win');
      expect(log.message).toContain('LUNAS');
      expect(log.message).toContain('Rp 50.000');
      expect(log.attempts).toBe(1);
    });

    it('tidak mengirim WA ganda jika status maju-mundur', async () => {
      await owner.patch(`/orders/${ids.o2}/status`, { status: 'PROCESSING' }).expect(200);
      await owner.patch(`/orders/${ids.o2}/status`, { status: 'FINISHED' }).expect(200);
      const r = await fani.get(`/wa/logs?orderId=${ids.o2}`);
      expect(r.body.filter((x: any) => x.type === 'FINISHED')).toHaveLength(1);
    });

    it('staff tidak boleh memundurkan status', async () => {
      const r = await fani.patch(`/orders/${ids.o2}/status`, { status: 'RECEIVED' }).expect(400);
      expect(r.body.message).toMatch(/Hanya Owner/);
    });

    it('customer tanpa nomor WA → log GAGAL dengan alasan jelas, kirim ulang ditolak ramah', async () => {
      const o = await fani.post('/orders', { customerId: ids.nophone, items: [{ serviceId: svc.CB, qty: 3 }] }).expect(201);
      await fani.patch(`/orders/${o.body.id}/status`, { status: 'FINISHED' }).expect(200);
      const logs = (await fani.get(`/wa/logs?orderId=${o.body.id}`)).body;
      expect(logs[0].status).toBe('FAILED');
      expect(logs[0].error).toMatch(/Nomor WA/);
      const re = await fani.post(`/wa/logs/${logs[0].id}/resend`).expect(400);
      expect(re.body.message).toMatch(/Nomor WA/);
      ids.nophoneOrder = o.body.id;
    });

    it('gateway error → dicoba ulang otomatis (backoff) sampai berhasil', async () => {
      const provider = app.get<WaProvider>(WA_PROVIDER);
      const spy = jest.spyOn(provider, 'send').mockResolvedValueOnce({ ok: false, error: 'gateway down' });
      const o = await fani.post('/orders', { customerId: ids.win, items: [{ serviceId: svc.CB, qty: 3 }] }).expect(201);
      await fani.patch(`/orders/${o.body.id}/status`, { status: 'FINISHED' }).expect(200);
      const failed = await waitFor(async () => (await fani.get(`/wa/logs?orderId=${o.body.id}`)).body.find((l: any) => l.error === 'gateway down'));
      expect(failed).toMatchObject({ status: 'QUEUED', attempts: 1 }); // belum FAILED: masih menunggu percobaan ke-2
      const ok = await waitFor(async () => (await fani.get(`/wa/logs?orderId=${o.body.id}`)).body.find((l: any) => l.status === 'SENT'), 12000);
      expect(ok).toMatchObject({ attempts: 2, error: null });
      spy.mockRestore();
      await fani.post(`/orders/${o.body.id}/cancel`).expect(201);
    });

    it('tombol "Kirim ulang" untuk log yang berstatus GAGAL', async () => {
      const o = await fani.post('/orders', { customerId: ids.win, items: [{ serviceId: svc.CB, qty: 3 }] }).expect(201);
      await fani.patch(`/orders/${o.body.id}/status`, { status: 'FINISHED' }).expect(200);
      const log = await waitFor(async () => (await fani.get(`/wa/logs?orderId=${o.body.id}`)).body.find((l: any) => l.status === 'SENT'));
      await app.get(PrismaService).waLog.update({ where: { id: log.id }, data: { status: 'FAILED', error: 'simulasi gagal' } });
      const re = await fani.post(`/wa/logs/${log.id}/resend`).expect(201);
      expect(re.body.status).toBe('QUEUED');
      await waitFor(async () => (await fani.get(`/wa/logs?orderId=${o.body.id}`)).body.find((l: any) => l.id === log.id && l.status === 'SENT'));
      await fani.post(`/orders/${o.body.id}/cancel`).expect(201);
    });

    it('status Selesai tidak dikirim bila owner mematikan WA otomatis', async () => {
      await owner.put('/settings', { wa: { autoSendFinished: false } }).expect(200);
      const o = await fani.post('/orders', { customerId: ids.win, items: [{ serviceId: svc.CB, qty: 3 }] }).expect(201);
      await fani.patch(`/orders/${o.body.id}/status`, { status: 'FINISHED' }).expect(200);
      expect((await fani.get(`/wa/logs?orderId=${o.body.id}`)).body).toHaveLength(0);
      await owner.put('/settings', { wa: { autoSendFinished: true } }).expect(200);
      await fani.post(`/orders/${o.body.id}/cancel`).expect(201);
    });

    it('template WA bisa diedit owner dan dipakai', async () => {
      await owner.put('/settings', { wa: { finishedTemplate: 'Nota {no_nota} atas nama {nama} selesai. {status_bayar}' } }).expect(200);
      const o = await fani.post('/orders', { customerId: ids.nida, items: [{ serviceId: svc.CB, qty: 3 }] }).expect(201);
      await fani.patch(`/orders/${o.body.id}/status`, { status: 'FINISHED' }).expect(200);
      const log = (await fani.get(`/wa/logs?orderId=${o.body.id}`)).body[0];
      expect(log.message).toBe(`Nota ${o.body.invoiceNo} atas nama Nida selesai. BELUM BAYAR — Rp 9.000`);
      await fani.post(`/orders/${o.body.id}/cancel`).expect(201);
    });
  });

  // ------------------------------------------------------------------ 5. Batal & hapus
  describe('Batal & hapus nota', () => {
    it('staff boleh membatalkan nota belum bayar, tapi tidak yang sudah dibayar', async () => {
      const a = await fani.post('/orders', { customerId: ids.win, items: [{ serviceId: svc.CB, qty: 3 }] }).expect(201);
      const c = await fani.post(`/orders/${a.body.id}/cancel`, { reason: 'salah input' }).expect(201);
      expect(c.body.status).toBe('CANCELLED');
      await fani.post(`/orders/${a.body.id}/pay-full`, { method: 'CASH' }).expect(400); // sudah batal

      const err = await fani.post(`/orders/${ids.o2}/cancel`).expect(400);
      expect(err.body.message).toMatch(/Owner/);
    });

    it('owner membatalkan nota berbayar → pembayaran di-void, hilang dari cashflow; hapus = soft delete', async () => {
      const o = await fani.post('/orders', { customerId: ids.win, items: [{ serviceId: svc.CK, qty: 4 }], payment: { method: 'QRIS' } }).expect(201);
      const before = (await owner.get('/cashflow/summary?period=day')).body.income.qris;
      const c = await owner.post(`/orders/${o.body.id}/cancel`).expect(201);
      expect(c.body.paidAmount).toBe(0);
      expect((await owner.get('/cashflow/summary?period=day')).body.income.qris).toBe(before - 20000);
      await fani.del(`/orders/${o.body.id}`).expect(403);
      await owner.del(`/orders/${o.body.id}`).expect(200);
      await fani.get(`/orders/${o.body.id}`).expect(404);
    });

    it('audit log mencatat perubahan status & pembayaran', async () => {
      const r = await owner.get('/audit?entity=Order&limit=500').expect(200);
      const actions = new Set(r.body.map((a: any) => a.action));
      for (const a of ['ORDER_CREATE', 'ORDER_STATUS', 'PAYMENT_ADD', 'PAYMENT_VOID', 'ORDER_CANCEL', 'ORDER_DELETE']) expect(actions).toContain(a);
    });
  });

  // ------------------------------------------------------------------ 6. Cashflow
  describe('Cashflow', () => {
    it('pemasukan dipisah Cash & QRIS + persentase pembanding; pengeluaran & bersih', async () => {
      await fani.post('/expenses', { category: 'Deterjen', description: 'Rinso 5kg', amount: 15000 }).expect(201);
      await ana.post('/expenses', { category: 'Listrik', amount: 5000, method: 'QRIS' }).expect(201);
      const s = (await owner.get('/cashflow/summary?period=day')).body;
      // o2: 20.000 cash + 30.000 qris ; o3: 25.000 qris (setelah void & bayar ulang)
      expect(s.income.cash).toBe(20000);
      expect(s.income.qris).toBe(55000);
      expect(s.income.total).toBe(75000);
      expect(s.income.cashPct + s.income.qrisPct).toBeCloseTo(100, 0);
      expect(s.income.qrisPct).toBeCloseTo(73.3, 1);
      expect(s.expense.total).toBe(20000);
      expect(s.net).toBe(55000);
      expect(s.netCash).toBe(20000 - 15000);
      expect(s.expense.byCategory[0]).toEqual({ category: 'Deterjen', amount: 15000 });
      expect(s.receivable).toBeGreaterThan(0); // o1 belum bayar
      expect(s.daily).toHaveLength(1);
    });

    it('laporan mingguan & bulanan memuat hari yang sama', async () => {
      const w = (await owner.get('/cashflow/summary?period=week')).body;
      const m = (await owner.get('/cashflow/summary?period=month')).body;
      expect(w.daily).toHaveLength(7);
      expect(m.daily.length).toBeGreaterThanOrEqual(28);
      expect(w.income.total).toBe(75000);
      expect(m.income.total).toBe(75000);
    });

    it('staff hanya melihat kas yang ia terima/catat sendiri', async () => {
      // fani menerima: o3 25.000 QRIS; ana menerima: o2 sisa 30.000 QRIS; fani menerima 20.000 cash o2
      const f = (await fani.get('/cashflow/summary?period=day')).body;
      const a = (await ana.get('/cashflow/summary?period=day')).body;
      expect(f.scope).toBe('mine');
      expect(f.income.total + a.income.total).toBe(75000);
      expect(a.expense.total).toBe(5000);
      expect((await owner.get('/cashflow/summary?period=day&staffId=' + 0)).body.scope).toBe('all');
    });

    it('buku kas campuran & export Excel', async () => {
      const e = (await owner.get('/cashflow/entries?period=day')).body;
      expect(e.filter((x: any) => x.kind === 'OUT')).toHaveLength(2);
      expect(e.filter((x: any) => x.kind === 'IN').length).toBeGreaterThanOrEqual(3);
      const res = await owner.get('/cashflow/export?period=month').buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('spreadsheetml');
      expect(res.headers['content-disposition']).toContain('.xlsx');
      expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK'); // file xlsx = zip
    });

    it('staff tidak bisa mengubah pengeluaran orang lain', async () => {
      const e = (await owner.get('/cashflow/entries?period=day')).body.find((x: any) => x.kind === 'OUT' && x.title === 'Listrik');
      await fani.patch(`/expenses/${e.id}`, { amount: 1 }).expect(400);
      await owner.patch(`/expenses/${e.id}`, { amount: 6000 }).expect(200);
      await owner.del(`/expenses/${e.id}`).expect(200);
    });

    it('dashboard: 4 angka utama', async () => {
      const d = (await owner.get('/dashboard')).body;
      expect(d.ordersToday).toBeGreaterThan(0);
      expect(d.unpaid.count).toBeGreaterThan(0);
      expect(d.ready).toBeGreaterThanOrEqual(1);
      expect(d.incomeToday.total).toBe(75000);
      expect((await fani.get('/dashboard')).body.incomeToday.scope).toBe('mine');
    });
  });

  // ------------------------------------------------------------------ 7. Customer / rekapan
  describe('Customer & rekapan', () => {
    it('rekap customer: jumlah nota, total belanja, belum bayar, kg, progres FREE', async () => {
      const r = (await fani.get('/customers?q=win')).body;
      expect(r).toHaveLength(1);
      const win = r[0];
      // o1 16.000 (belum bayar) + o2 50.000 (lunas); yang dibatalkan/dihapus tidak dihitung
      expect(win.orderCount).toBe(2);
      expect(win.totalSpent).toBe(66000);
      expect(win.unpaid).toBe(16000);
      expect(win.totalKg).toBe(3 + 5);
      expect(win.free).toMatchObject({ count: 1, threshold: 9, eligible: false }); // hanya o2 (lunas, CKX)
      expect(win.lastOrderAt).toBeTruthy();
    });

    it('filter belum bayar & detail customer berisi riwayat nota', async () => {
      const unpaid = (await fani.get('/customers?unpaid=1')).body;
      expect(unpaid.map((c: any) => c.name)).toContain('Bu Win');
      const d = (await fani.get(`/customers/${ids.win}`)).body;
      expect(d.orders.map((o: any) => o.id)).toEqual(expect.arrayContaining([ids.o1, ids.o2]));
    });

    it('export Excel rekapan customer', async () => {
      const res = await owner.get('/customers/export').buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(res.status).toBe(200);
      expect((res.body as Buffer).subarray(0, 2).toString()).toBe('PK');
    });
  });

  // ------------------------------------------------------------------ 8. FREE
  describe('Menu FREE (9× cuci gratis 1×)', () => {
    let loyal: number;

    const washPaid = (customerId: number, who: Api = fani, code = 'CK', qty = 4) =>
      who.post('/orders', { customerId, items: [{ serviceId: svc[code], qty }], payment: { method: 'CASH' } }).expect(201);

    it('hanya nota LUNAS dan layanan cuci yang dihitung; belum bayar, batal, setrika tidak', async () => {
      loyal = (await fani.post('/customers', { name: 'Pelanggan Setia', phone: '081200000009' }).expect(201)).body.id;
      for (let i = 0; i < 3; i++) await washPaid(loyal);
      await fani.post('/orders', { customerId: loyal, items: [{ serviceId: svc.CK, qty: 4 }] }).expect(201); // belum bayar
      const cancelled = await washPaid(loyal);
      await owner.post(`/orders/${cancelled.body.id}/cancel`).expect(201);
      await washPaid(loyal, fani, 'ST', 4); // setrika → tidak dihitung
      await washPaid(loyal, fani, 'SPK', 2); // satuan → tidak dihitung
      expect((await fani.get(`/customers/${loyal}`)).body.free.count).toBe(3);
    });

    it('melunasi nota belum bayar menambah counter', async () => {
      const unpaid = (await fani.get(`/orders?customerId=${loyal}&payment=unpaid`)).body[0];
      await fani.post(`/orders/${unpaid.id}/pay-full`, { method: 'QRIS' }).expect(201);
      expect((await fani.get(`/customers/${loyal}`)).body.free.count).toBe(4);
    });

    it('klaim sebelum 9 nota ditolak', async () => {
      const r = await fani.post('/free/claim', { customerId: loyal, serviceId: svc.CK, qty: 3 }).expect(400);
      expect(r.body.message).toBe('Belum berhak FREE: baru 4/9 nota');
    });

    it('mencapai 9/9 → muncul di daftar berhak klaim untuk staff/owner, customer TIDAK dikirimi WA', async () => {
      for (let i = 0; i < 5; i++) await washPaid(loyal, i % 2 ? ana : fani);
      const f = (await fani.get('/free')).body;
      expect(f.threshold).toBe(9);
      const row = f.ready.find((c: any) => c.id === loyal);
      expect(row).toMatchObject({ count: 9, available: 1, cycle: 0, eligible: true });
      // staff melihat penanda di daftar order dan detail nota customer ini
      expect((await fani.get(`/orders?customerId=${loyal}&limit=1`)).body[0].freeAvailable).toBe(1);
      expect((await fani.get(`/customers/${loyal}`)).body.free).toMatchObject({ available: 1, cycle: 0 });
      // tidak ada pengingat otomatis ke customer (tunggu sebentar agar antrean sempat memproses bila ada)
      await new Promise((r) => setTimeout(r, 600));
      const logs = (await fani.get('/wa/logs?limit=300')).body;
      expect(logs.filter((l: any) => l.type === 'FREE_READY' || l.message?.includes('GRATIS'))).toHaveLength(0);
    });

    it('klaim FREE 3 kg → nota Rp 0 bertanda FREE, otomatis lunas, counter reset ke 0', async () => {
      const r = await fani.post('/free/claim', { customerId: loyal, serviceId: svc.CK, qty: 3 }).expect(201);
      expect(r.body.isFree).toBe(true);
      expect(r.body.total).toBe(0);
      expect(r.body.paymentStatus).toBe('PAID');
      expect(r.body.note).toMatch(/FREE/);
      expect((await fani.get(`/customers/${loyal}`)).body.free).toMatchObject({ count: 0, eligible: false });
      const claims = (await fani.get('/free/claims')).body;
      expect(claims[0]).toMatchObject({ customer: { id: loyal }, order: { invoiceNo: r.body.invoiceNo } });
      expect((await fani.get('/free')).body.ready.map((c: any) => c.id)).not.toContain(loyal);
    });

    it('nota FREE tidak menambah counter, tidak masuk pemasukan, dan tidak bisa dibatalkan', async () => {
      const freeOrder = (await fani.get(`/orders?customerId=${loyal}&limit=1`)).body[0];
      expect(freeOrder.isFree).toBe(true);
      expect((await fani.get(`/customers/${loyal}`)).body.free.count).toBe(0);
      const r = await owner.post(`/orders/${freeOrder.id}/cancel`).expect(400);
      expect(r.body.message).toMatch(/FREE/);
    });

    it('nota yang sudah dipakai klaim tidak bisa dibatalkan/dihapus/di-void', async () => {
      const used = (await fani.get(`/customers/${loyal}`)).body.orders.find((o: any) => !o.isFree && o.countsForFree && o.status !== 'CANCELLED' && o.paymentStatus === 'PAID');
      const r = await owner.post(`/orders/${used.id}/cancel`).expect(400);
      expect(r.body.message).toMatch(/klaim FREE/);
      await owner.del(`/payments/${used.payments[0].id}`).expect(400);
    });

    it('klaim dengan berat melebihi jatah: 4 kg CK → hanya 3 kg gratis, sisa 1 kg × 5.000 ditagih', async () => {
      for (let i = 0; i < 9; i++) await washPaid(loyal);
      const r = await fani.post('/free/claim', { customerId: loyal, serviceId: svc.CK, qty: 4 }).expect(201);
      expect(r.body.subtotal).toBe(20000);
      expect(r.body.total).toBe(5000);
      expect(r.body.discount).toBe(15000);
      expect(r.body.paymentStatus).toBe('UNPAID');
    });

    it('sisa lebih dari 9 nota tidak hangus (13 nota → klaim → sisa 4)', async () => {
      const c = (await fani.post('/customers', { name: 'Rajin Banget', phone: '081200000010' }).expect(201)).body.id;
      for (let i = 0; i < 13; i++) await washPaid(c);
      await fani.post('/free/claim', { customerId: c, serviceId: svc.CB, qty: 3 }).expect(201);
      expect((await fani.get(`/customers/${c}`)).body.free).toMatchObject({ count: 4, available: 0, cycle: 4 });
    });

    it('hak FREE menumpuk tanpa kedaluwarsa: 20 nota → 2× FREE tersedia, sisa progres 2/9', async () => {
      const c = (await fani.post('/customers', { name: 'Langganan Lama', phone: '081200000020' }).expect(201)).body.id;
      for (let i = 0; i < 20; i++) await washPaid(c);
      expect((await fani.get(`/customers/${c}`)).body.free).toMatchObject({ count: 20, available: 2, cycle: 2, eligible: true });
      const row = (await fani.get('/free')).body.ready.find((r: any) => r.id === c);
      expect(row).toMatchObject({ available: 2, cycle: 2 });
      // klaim pertama & kedua berhasil, hak berkurang satu-satu
      await fani.post('/free/claim', { customerId: c, serviceId: svc.CK, qty: 3 }).expect(201);
      expect((await fani.get(`/customers/${c}`)).body.free).toMatchObject({ count: 11, available: 1, cycle: 2 });
      await ana.post('/free/claim', { customerId: c, serviceId: svc.CK, qty: 3 }).expect(201);
      expect((await fani.get(`/customers/${c}`)).body.free).toMatchObject({ count: 2, available: 0, cycle: 2 });
      // hak habis → klaim ketiga ditolak
      const r = await fani.post('/free/claim', { customerId: c, serviceId: svc.CK, qty: 3 }).expect(400);
      expect(r.body.message).toBe('Belum berhak FREE: baru 2/9 nota');
    });

    it('pengaturan FREE tidak lagi punya opsi pengingat ke customer', async () => {
      const s = (await owner.get('/settings')).body;
      expect(s.free).toEqual({ threshold: 9, freeKg: 3 });
      expect(s.wa).not.toHaveProperty('freeReadyTemplate');
    });

    it('klaim bersamaan hanya berhasil satu kali', async () => {
      const c = (await fani.post('/customers', { name: 'Rebutan', phone: '081200000011' }).expect(201)).body.id;
      for (let i = 0; i < 9; i++) await washPaid(c);
      const [a, b] = await Promise.all([
        fani.post('/free/claim', { customerId: c, serviceId: svc.CK, qty: 3 }),
        ana.post('/free/claim', { customerId: c, serviceId: svc.CK, qty: 3 }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 400]);
    });

    it('ambang & jatah kg bisa diubah owner', async () => {
      await owner.put('/settings', { free: { threshold: 2, freeKg: 5 } }).expect(200);
      const c = (await fani.post('/customers', { name: 'Ambang Dua', phone: '081200000012' }).expect(201)).body.id;
      await washPaid(c);
      await washPaid(c);
      const r = await fani.post('/free/claim', { customerId: c, serviceId: svc.CK, qty: 5 }).expect(201);
      expect(r.body.total).toBe(0);
      await owner.put('/settings', { free: { threshold: 9, freeKg: 3 } }).expect(200);
    });

    it('FREE hanya untuk layanan per kg', async () => {
      const r = await fani.post('/free/claim', { customerId: loyal, serviceId: svc.SPK, qty: 1 }).expect(400);
      expect(r.body.message).toMatch(/per kg/);
    });
  });

  // ------------------------------------------------------------------ 9. Staff, bonus
  describe('Staff & Bonus', () => {
    const period = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);

    it('performa staff (owner) dan rekap harian seperti buku target', async () => {
      const p = (await owner.get(`/staff/performance?period=${period}`)).body;
      const f = p.find((x: any) => x.name === 'Fani');
      expect(f.orderCount).toBeGreaterThan(0);
      expect(f.kg).toBeGreaterThan(0);
      await fani.get('/staff/performance').expect(403);

      const d = (await owner.get('/staff/daily-recap')).body;
      expect(d.hari).toBeTruthy();
      expect(d.staff.map((s: any) => s.name)).toEqual(expect.arrayContaining(['Fani', 'Ana']));
      const own = (await ana.get('/staff/daily-recap')).body;
      expect(own.staff.map((s: any) => s.name)).toEqual(['Ana']); // staff hanya melihat miliknya
      expect(own.staff[0].items[0]).toHaveProperty('kg');
    });

    it('performa & rekap harian memisahkan kg cuci, setrika, dan cuci+setrika', async () => {
      await owner.post('/users', { name: 'Dewi', username: 'dewi', password: 'dewi1234' }).expect(201);
      const dewi = makeApi(app, (await login(app, 'dewi', 'dewi1234')).token);
      const cust = (await dewi.post('/customers', { name: 'Uji Jenis Kerja' }).expect(201)).body.id;
      const o = await dewi.post('/orders', { customerId: cust, items: [
        { serviceId: svc.CB, qty: 4 },   // cuci
        { serviceId: svc.CBX, qty: 3 },  // cuci (express)
        { serviceId: svc.ST, qty: 5 },   // setrika
        { serviceId: svc.CK, qty: 6 },   // cuci+setrika
        { serviceId: svc.CKX, qty: 2 },  // cuci+setrika (express)
        { serviceId: svc.SPK, qty: 2 },  // satuan: bukan kg, tidak dihitung
      ] }).expect(201);
      expect(o.body.items.map((i: any) => i.workType)).toEqual(['WASH', 'WASH', 'IRON', 'WASH_IRON', 'WASH_IRON', 'OTHER']);

      const perf = (await owner.get(`/staff/performance?period=${period}`)).body.find((x: any) => x.name === 'Dewi');
      expect(perf).toMatchObject({ kg: 20, kgWash: 7, kgIron: 5, kgWashIron: 8 });
      expect(perf.kgWash + perf.kgIron + perf.kgWashIron).toBe(perf.kg); // tidak ada hitung ganda

      const rec = (await dewi.get('/staff/daily-recap')).body.staff[0];
      expect(rec).toMatchObject({ name: 'Dewi', totalKg: 20, kgWash: 7, kgIron: 5, kgWashIron: 8 });
    });

    it('jenis kerja tersimpan pada nota (snapshot): mengubah layanan tidak mengubah nota lama', async () => {
      const g = (await owner.post('/services', { code: 'TST', name: 'Layanan Uji', category: 'REGULER', unit: 'KG', rate: 1000, workType: 'IRON' }).expect(201)).body;
      expect(g.workType).toBe('IRON');
      const c = (await fani.post('/customers', { name: 'Snapshot' }).expect(201)).body.id;
      const o = (await fani.post('/orders', { customerId: c, items: [{ serviceId: g.id, qty: 3 }] }).expect(201)).body;
      await owner.patch(`/services/${g.id}`, { workType: 'WASH' }).expect(200);
      expect((await fani.get(`/orders/${o.id}`)).body.items[0].workType).toBe('IRON');
      await owner.patch(`/services/${g.id}`, { isActive: false }).expect(200);
    });

    it('aturan bonus default ada; owner bisa mengubah, staff tidak', async () => {
      const rules = (await fani.get('/bonus/rules')).body;
      expect(rules.map((r: any) => r.type)).toEqual(['PER_KG', 'PERCENT_OMZET']);
      await fani.put('/bonus/rules', { rules: [] }).expect(403);
      const saved = await owner
        .put('/bonus/rules', {
          rules: [
            { id: rules[0].id, name: 'Bonus per kg', type: 'PER_KG', value: 100, minTarget: 10, isActive: true },
            { name: 'Bonus omzet 2%', type: 'PERCENT_OMZET', value: 2, minTarget: 0, isActive: true },
          ],
        })
        .expect(200);
      expect(saved.body).toHaveLength(2); // aturan ke-2 lama dihapus, yang baru ditambah
      await owner.put('/bonus/rules', { rules: [{ name: 'x', type: 'PERCENT_OMZET', value: 150, minTarget: 0, isActive: true }] }).expect(400);
    });

    it('Bonus Saya vs rekap owner — konsisten dengan nota lunas non-FREE', async () => {
      const mine = (await fani.get(`/bonus/me?period=${period}`)).body;
      expect(mine.totalKg).toBeGreaterThan(10);
      const kgBonus = mine.lines.find((l: any) => l.type === 'PER_KG');
      const omzetBonus = mine.lines.find((l: any) => l.type === 'PERCENT_OMZET');
      expect(kgBonus.amount).toBe(Math.round(mine.totalKg * 100));
      expect(omzetBonus.amount).toBe(Math.round(mine.omzet * 0.02));
      expect(mine.amount).toBe(kgBonus.amount + omzetBonus.amount);

      const all = (await owner.get(`/bonus/summary?period=${period}`)).body;
      expect(all.find((x: any) => x.name === 'Fani').amount).toBe(mine.amount);
      expect(all.map((x: any) => x.name)).toEqual(expect.arrayContaining(['Fani', 'Ana']));
    });

    it('simpan rekap bulan → tandai dibayar → angka dibekukan', async () => {
      const gen = (await owner.post('/bonus/records/generate', { period })).body;
      const f = gen.find((x: any) => x.name === 'Fani');
      expect(f.record.status).toBe('DRAFT');
      await fani.post('/bonus/records/generate', { period }).expect(403);
      await owner.patch(`/bonus/records/${f.record.id}/pay`).expect(200);
      await owner.patch(`/bonus/records/${f.record.id}/pay`).expect(400);
      const frozenAmount = f.amount;
      // Nota baru setelah dibayar tidak mengubah angka bonus yang sudah dibayar
      await fani.post('/orders', { customerId: ids.win, items: [{ serviceId: svc.CK, qty: 20 }], payment: { method: 'CASH' } }).expect(201);
      const mine = (await fani.get(`/bonus/me?period=${period}`)).body;
      expect(mine.amount).toBe(frozenAmount);
      expect(mine.record.status).toBe('PAID');
    });
  });

  // ------------------------------------------------------------------ 10. Pengaturan
  describe('Pengaturan', () => {
    it('semua login boleh baca, hanya owner boleh ubah; nilai tidak valid ditolak', async () => {
      const s = (await fani.get('/settings')).body;
      expect(s.free).toMatchObject({ threshold: 9, freeKg: 3 });
      expect(s.shop.name).toBe('Djotos Laundry');
      await owner.put('/settings', { shop: { name: 'Djotos Laundry Pusat', address: 'Jl. Mawar 1' } }).expect(200);
      expect((await fani.get('/settings')).body.shop.name).toBe('Djotos Laundry Pusat');
      await owner.put('/settings', { free: { threshold: 0 } }).expect(400);
      await owner.put('/settings', { free: { threshold: 'abc' } }).expect(400);
      await owner.put('/settings', { rahasia: {} }).expect(400);
    });

    it('ganti password sendiri', async () => {
      await ana.post('/auth/change-password', { oldPassword: 'salah', newPassword: 'baru1234' }).expect(400);
      await ana.post('/auth/change-password', { oldPassword: 'staff123', newPassword: 'baru1234' }).expect(201);
      expect((await login(app, 'ana', 'baru1234')).status).toBe(201);
    });

    it('status gateway WA', async () => {
      expect((await fani.get('/wa/status')).body).toEqual({ provider: 'mock', configured: true });
    });
  });
});
