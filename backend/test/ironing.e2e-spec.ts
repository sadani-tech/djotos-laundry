import { INestApplication } from '@nestjs/common';
import { Api, createApp, login, makeApi } from './helpers';

describe('Rekap hasil setrika dari pesanan pelanggan', () => {
  let app: INestApplication;
  let owner: Api, first: Api, second: Api;
  let firstId: number;
  let washIronId: number, ironId: number, customerId: number;
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

  beforeAll(async () => {
    app = await createApp();
    owner = makeApi(app, (await login(app, 'owner', 'owner123')).token);
    const suffix = String(Date.now()).slice(-6);
    firstId = (await owner.post('/users', { name: 'Staff Setrika Satu', username: `iron-a-${suffix}`, password: 'staff123' }).expect(201)).body.id;
    (await owner.post('/users', { name: 'Staff Setrika Dua', username: `iron-b-${suffix}`, password: 'staff123' }).expect(201));
    first = makeApi(app, (await login(app, `iron-a-${suffix}`, 'staff123')).token);
    second = makeApi(app, (await login(app, `iron-b-${suffix}`, 'staff123')).token);
    washIronId = (await owner.post('/services', { code: `W${suffix.slice(0, 5)}`, name: 'Tes Cuci Setrika', category: 'REGULER', unit: 'KG', rate: 5000, workType: 'WASH_IRON' }).expect(201)).body.id;
    ironId = (await owner.post('/services', { code: `I${suffix.slice(0, 5)}`, name: 'Tes Setrika', category: 'REGULER', unit: 'KG', rate: 4000, workType: 'IRON' }).expect(201)).body.id;
    customerId = (await first.post('/customers', { name: 'Customer Pesanan Setrika' }).expect(201)).body.id;
  });
  afterAll(async () => { await app.close(); });

  it('hanya menghitung nota yang tahap Setrikanya diselesaikan dan mencatat staff penyelesai', async () => {
    const combined = await first.post('/orders', { customerId, items: [{ serviceId: washIronId, qty: 1.5 }] }).expect(201);
    await first.patch(`/orders/${combined.body.id}/status`, { status: 'WASHING' }).expect(200);
    await first.patch(`/orders/${combined.body.id}/status`, { status: 'IRONING' }).expect(200);
    await first.patch(`/orders/${combined.body.id}/status`, { status: 'FINISHED' }).expect(200);

    const ironOnly = await second.post('/orders', { customerId, items: [{ serviceId: ironId, qty: 2.25 }] }).expect(201);
    await second.patch(`/orders/${ironOnly.body.id}/status`, { status: 'IRONING' }).expect(200);
    await second.patch(`/orders/${ironOnly.body.id}/status`, { status: 'FINISHED' }).expect(200);

    const recap = (await owner.get(`/staff/daily-recap?date=${date}`).expect(200)).body;
    expect(recap.totalKg).toBe(3.75);
    expect(recap.staff.find((s: any) => s.name === 'Staff Setrika Satu')).toMatchObject({ totalKg: 1.5, items: [{ name: 'Customer Pesanan Setrika', kg: 1.5 }] });
    expect(recap.staff.find((s: any) => s.name === 'Staff Setrika Dua')).toMatchObject({ totalKg: 2.25, items: [{ name: 'Customer Pesanan Setrika', kg: 2.25 }] });
    expect(recap.staff.flatMap((s: any) => s.entries).map((e: any) => e.orderId)).toEqual(expect.arrayContaining([combined.body.id, ironOnly.body.id]));
    expect((await first.get(`/staff/daily-recap?date=${date}`).expect(200)).body.totalKg).toBe(1.5);
    expect((await second.get(`/staff/daily-recap?date=${date}`).expect(200)).body.totalKg).toBe(2.25);

    const period = date.slice(0, 7);
    const performance = (await owner.get(`/staff/performance?period=${period}`).expect(200)).body;
    expect(performance.find((staff: any) => staff.userId === firstId).kgIron).toBe(1.5);
    expect(performance.find((staff: any) => staff.name === 'Staff Setrika Dua').kgIron).toBe(2.25);
    await first.post('/staff/ironing', { date, customerName: 'Tidak boleh input bebas', kg: 1 }).expect(404);
  });

  it('nota yang belum selesai setrika tidak masuk rekap', async () => {
    const order = await first.post('/orders', { customerId, items: [{ serviceId: ironId, qty: 1.25 }] }).expect(201);
    await first.patch(`/orders/${order.body.id}/status`, { status: 'IRONING' }).expect(200);
    const recap = (await owner.get(`/staff/daily-recap?date=${date}`).expect(200)).body;
    expect(recap.totalKg).toBe(3.75);
  });
});
