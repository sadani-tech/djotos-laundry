import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../src/common/prisma.service';
import { periodRange } from '../src/common/time';
import { Api, createApp, login, makeApi } from './helpers';

describe('Hasil setrika parsial dari nota customer', () => {
  let app: INestApplication;
  let owner: Api, first: Api, second: Api;
  let firstId: number, secondId: number, washIronId: number, ironId: number, customerId: number;
  const date = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);

  beforeAll(async () => {
    app = await createApp();
    owner = makeApi(app, (await login(app, 'owner', 'owner123')).token);
    const suffix = String(Date.now()).slice(-6);
    firstId = (await owner.post('/users', { name: 'Staff Setrika Satu', username: `iron-a-${suffix}`, password: 'staff123' }).expect(201)).body.id;
    secondId = (await owner.post('/users', { name: 'Staff Setrika Dua', username: `iron-b-${suffix}`, password: 'staff123' }).expect(201)).body.id;
    first = makeApi(app, (await login(app, `iron-a-${suffix}`, 'staff123')).token);
    second = makeApi(app, (await login(app, `iron-b-${suffix}`, 'staff123')).token);
    washIronId = (await owner.post('/services', { code: `W${suffix.slice(0, 5)}`, name: 'Tes Cuci Setrika', category: 'REGULER', unit: 'KG', rate: 5000, workType: 'WASH_IRON' }).expect(201)).body.id;
    ironId = (await owner.post('/services', { code: `I${suffix.slice(0, 5)}`, name: 'Tes Setrika', category: 'REGULER', unit: 'KG', rate: 4000, workType: 'IRON' }).expect(201)).body.id;
    customerId = (await first.post('/customers', { name: 'Customer Pesanan Setrika' }).expect(201)).body.id;
  });
  afterAll(async () => { await app.close(); });

  it('membagi 20 kg ke dua hari dan dua staff tanpa melebihi berat nota', async () => {
    const order = (await first.post('/orders', { customerId, items: [{ serviceId: washIronId, qty: 20 }] }).expect(201)).body;
    await first.post('/staff/ironing', { orderId: order.id, kg: 1 }).expect(400);
    await first.patch(`/orders/${order.id}/status`, { status: 'WASHING' }).expect(200);
    await first.patch(`/orders/${order.id}/status`, { status: 'IRONING' }).expect(200);
    const baseline = (await owner.get(`/staff/daily-recap?date=${date}`).expect(200)).body.totalKg;
    const pending = (await second.get('/staff/ironing/pending').expect(200)).body;
    expect(pending.find((x: any) => x.orderId === order.id)).toMatchObject({ totalKg: 20, doneKg: 0, remainingKg: 20 });

    const firstSession = (await first.post('/staff/ironing', { orderId: order.id, kg: 5 }).expect(201)).body;
    const yesterday = periodRange('day', date).start;
    yesterday.setDate(yesterday.getDate() - 1);
    await app.get(PrismaService).ironingEntry.update({ where: { id: firstSession.id }, data: { createdAt: yesterday } });
    await first.post('/staff/ironing', { orderId: order.id, kg: 10 }).expect(201);
    expect((await first.patch(`/orders/${order.id}/status`, { status: 'FINISHED' }).expect(400)).body.message).toMatch(/sisa 5 kg/);
    expect((await second.post('/staff/ironing', { orderId: order.id, kg: 5.01 }).expect(400)).body.message).toMatch(/melebihi sisa/);
    const simultaneous = await Promise.all([
      second.post('/staff/ironing', { orderId: order.id, kg: 5 }),
      second.post('/staff/ironing', { orderId: order.id, kg: 5 }),
    ]);
    expect(simultaneous.map((r) => r.status).sort()).toEqual([201, 400]);
    await second.post('/staff/ironing', { orderId: order.id, kg: 0.01 }).expect(400);
    expect((await owner.get('/staff/ironing/pending').expect(200)).body.some((x: any) => x.orderId === order.id)).toBe(false);
    await second.patch(`/orders/${order.id}/status`, { status: 'FINISHED' }).expect(200);

    const today = (await owner.get(`/staff/daily-recap?date=${date}`).expect(200)).body;
    expect(today.totalKg - baseline).toBe(15);
    expect(today.staff.find((s: any) => s.userId === firstId).entries.find((e: any) => e.orderId === order.id).kg).toBe(10);
    expect(today.staff.find((s: any) => s.userId === secondId).entries.find((e: any) => e.orderId === order.id).kg).toBe(5);
    expect((await first.get(`/staff/daily-recap?date=${date}`).expect(200)).body.totalKg).toBe(10);
    expect((await second.get(`/staff/daily-recap?date=${date}`).expect(200)).body.totalKg).toBe(5);
    expect((await first.get(`/staff/daily-recap?date=${date}`).expect(200)).body.staff[0].entries[0].orderId).toBe(order.id);
    const earlier = new Date(yesterday.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    expect((await first.get(`/staff/daily-recap?date=${earlier}`).expect(200)).body.totalKg).toBe(5);
    const performance = (await owner.get(`/staff/performance?period=${date.slice(0, 7)}`).expect(200)).body;
    expect(performance.find((s: any) => s.userId === firstId).kgIron).toBeGreaterThanOrEqual(10);
    expect(performance.find((s: any) => s.userId === secondId).kgIron).toBeGreaterThanOrEqual(5);
  });

  it('menolak input bebas dan mencatat layanan setrika saja', async () => {
    const order = (await first.post('/orders', { customerId, items: [{ serviceId: ironId, qty: 2.25 }] }).expect(201)).body;
    await first.patch(`/orders/${order.id}/status`, { status: 'IRONING' }).expect(200);
    await first.post('/staff/ironing', { customerName: 'Input bebas', kg: 1 }).expect(400);
    await first.post('/staff/ironing', { orderId: order.id, kg: 2.251 }).expect(400);
    await first.post('/staff/ironing', { orderId: order.id, kg: 2.25 }).expect(201);
    await first.patch(`/orders/${order.id}/status`, { status: 'FINISHED' }).expect(200);
  });
});
