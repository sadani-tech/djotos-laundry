import { INestApplication } from '@nestjs/common';
import { Api, createApp, login, makeApi } from './helpers';
import { PrismaService } from '../src/common/prisma.service';

describe('Hasil setrika mandiri', () => {
  let app: INestApplication;
  let owner: Api, first: Api, second: Api;
  let firstId: number, secondId: number;
  const date = '2026-02-28';

  beforeAll(async () => {
    app = await createApp();
    owner = makeApi(app, (await login(app, 'owner', 'owner123')).token);
    firstId = (await owner.post('/users', { name: 'Setrika Satu', username: 'iron-one', password: 'staff123' }).expect(201)).body.id;
    secondId = (await owner.post('/users', { name: 'Setrika Dua', username: 'iron-two', password: 'staff123' }).expect(201)).body.id;
    first = makeApi(app, (await login(app, 'iron-one', 'staff123')).token);
    second = makeApi(app, (await login(app, 'iron-two', 'staff123')).token);
  });
  afterAll(async () => { await app.close(); });

  it('tanpa nota: menggabungkan customer, menghitung kg per pegawai dan total sehari', async () => {
    await first.post('/staff/ironing', { date, customerName: '  Bu   Siti  ', kg: 0.1 }).expect(201);
    await first.post('/staff/ironing', { date, customerName: 'bu siti', kg: 0.2 }).expect(201);
    await first.post('/staff/ironing', { date, customerName: 'Pak Budi', kg: 3.25 }).expect(201);
    await owner.post('/staff/ironing', { date, staffId: secondId, customerName: 'Bu Siti', kg: 2.5 }).expect(201);
    const recap = (await owner.get(`/staff/daily-recap?date=${date}`).expect(200)).body;
    expect(recap.totalKg).toBe(6.05);
    expect(recap.staff.find((s: any) => s.userId === firstId)).toMatchObject({ totalKg: 3.55, items: [{ name: 'Bu Siti', kg: 0.3 }, { name: 'Pak Budi', kg: 3.25 }] });
    const own = (await first.get(`/staff/daily-recap?date=${date}`)).body;
    expect(own.totalKg).toBe(3.55);
    expect(own.staff.map((s: any) => s.userId)).toEqual([firstId]);
    const perf = (await owner.get('/staff/performance?period=2026-02')).body;
    expect(perf.find((s: any) => s.userId === firstId)).toMatchObject({ orderCount: 0, kg: 0, kgIron: 3.55 });
    expect((await owner.get('/staff/daily-recap?date=2026-03-01')).body).toMatchObject({ totalKg: 0, staff: [] });
  });

  it('menolak baca/tulis tanpa login, pemalsuan pegawai dan perubahan catatan pegawai lain', async () => {
    const body = { date, customerName: 'Beda pegawai', kg: 1 };
    const entry = (await first.post('/staff/ironing', body).expect(201)).body;
    await makeApi(app).get(`/staff/daily-recap?date=${date}`).expect(401);
    await makeApi(app).post('/staff/ironing', body).expect(401);
    await second.post('/staff/ironing', { ...body, staffId: firstId }).expect(403);
    await first.patch(`/staff/ironing/${entry.id}`, { ...body, staffId: secondId }).expect(403);
    await second.patch(`/staff/ironing/${entry.id}`, body).expect(404);
    await second.del(`/staff/ironing/${entry.id}`).expect(404);
    await first.del(`/staff/ironing/${entry.id}`).expect(200);
  });

  it('koreksi tanggal, berat, nama dan pegawai; soft delete memperbarui total dan tercatat di audit', async () => {
    const body = { date: '2026-03-31', customerName: 'Koreksi', kg: 5 };
    const entry = (await first.post('/staff/ironing', body).expect(201)).body;
    await first.patch(`/staff/ironing/${entry.id}`, { ...body, customerName: 'Koreksi staff', kg: 4.5 }).expect(200);
    await owner.patch(`/staff/ironing/${entry.id}`, { date: '2026-04-01', staffId: secondId, customerName: 'Selesai', kg: 1.25 }).expect(200);
    expect((await owner.get('/staff/daily-recap?date=2026-03-31')).body.totalKg).toBe(0);
    expect((await second.get('/staff/daily-recap?date=2026-04-01')).body.totalKg).toBe(1.25);
    expect((await owner.get('/staff/performance?period=2026-03')).body.find((s: any) => s.userId === firstId).kgIron).toBe(0);
    expect((await owner.get('/staff/performance?period=2026-04')).body.find((s: any) => s.userId === secondId).kgIron).toBe(1.25);
    await first.del(`/staff/ironing/${entry.id}`).expect(404);
    await owner.del(`/staff/ironing/${entry.id}`).expect(200);
    await owner.patch(`/staff/ironing/${entry.id}`, body).expect(404);
    await owner.del(`/staff/ironing/${entry.id}`).expect(404);
    expect((await owner.get('/staff/daily-recap?date=2026-04-01')).body.totalKg).toBe(0);
    expect((await owner.get('/staff/performance?period=2026-04')).body.find((s: any) => s.userId === secondId).kgIron).toBe(0);
    const db = app.get(PrismaService);
    expect((await db.ironingEntry.findUniqueOrThrow({ where: { id: entry.id } })).deletedAt).not.toBeNull();
    const audit = (await owner.get(`/audit?entity=IroningEntry&entityId=${entry.id}`)).body;
    expect(audit.map((a: any) => a.action)).toEqual(['IRONING_DELETE', 'IRONING_UPDATE', 'IRONING_UPDATE', 'IRONING_CREATE']);
  });

  it('validasi tanggal kalender, kg positif maksimal 2 desimal, nama dan pegawai aktif', async () => {
    const body = { date, customerName: 'Validasi', kg: 1 };
    for (const invalid of [{ date: '2026-02-30' }, { date: '2026-13-01' }, { date: 'abc' }, { customerName: '   ' }, { customerName: 'X'.repeat(101) }, { kg: 0 }, { kg: -1 }, { kg: 1.234 }, { kg: '1.5' }, { kg: 10001 }]) {
      await first.post('/staff/ironing', { ...body, ...invalid }).expect(400);
    }
    await owner.post('/staff/ironing', { ...body, staffId: 999999 }).expect(400);
    const inactive = (await owner.post('/users', { name: 'Nonaktif Setrika', username: 'iron-inactive', password: 'staff123' })).body;
    await owner.patch(`/users/${inactive.id}`, { isActive: false }).expect(200);
    await owner.post('/staff/ironing', { ...body, staffId: inactive.id }).expect(400);
    await first.get('/staff/daily-recap?date=2026-02-30').expect(400);
    await owner.get('/staff/performance?period=2026-13').expect(400);
  });
});
