// Seeder: layanan dari pricelist, akun owner + 2 staff, aturan bonus, dan (opsional) data contoh.
import { PrismaClient, Role, ServiceCategory, Unit, PayMethod, OrderStatus, PaymentStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { calcLinePrice } from '../src/common/pricing';
import { wibDateStr } from '../src/common/time';

try {
  process.loadEnvFile();
} catch {
  /* tanpa .env */
}

const prisma = new PrismaClient();

type SvcSeed = {
  code: string; name: string; category: ServiceCategory; unit: Unit; rate: number;
  minQty: number; minPrice?: number; durationHours: number; countsForFree: boolean;
};

// Sumber: Daftar_Harga_Djotos_Laundry.pdf. Estimasi durasi tidak ada di pricelist → default (bisa diubah owner).
export const SERVICES: SvcSeed[] = [
  { code: 'CK', name: 'Cuci Kering (Cuci + Setrika)', category: 'REGULER', unit: 'KG', rate: 5000, minQty: 3, minPrice: 16000, durationHours: 48, countsForFree: true },
  { code: 'CB', name: 'Cuci Basah', category: 'REGULER', unit: 'KG', rate: 3000, minQty: 3, durationHours: 48, countsForFree: true },
  { code: 'ST', name: 'Setrika', category: 'REGULER', unit: 'KG', rate: 4000, minQty: 3, durationHours: 48, countsForFree: false },
  { code: 'CKX', name: 'Cuci Kering Express', category: 'EXPRESS', unit: 'KG', rate: 7000, minQty: 2, durationHours: 24, countsForFree: true },
  { code: 'CBX', name: 'Cuci Basah Express', category: 'EXPRESS', unit: 'KG', rate: 4000, minQty: 3, durationHours: 24, countsForFree: true },
  { code: 'STX', name: 'Setrika Express', category: 'EXPRESS', unit: 'KG', rate: 6000, minQty: 2, durationHours: 24, countsForFree: false },
  { code: 'SPK', name: 'Sprei Kecil', category: 'SATUAN', unit: 'PCS', rate: 8000, minQty: 1, durationHours: 72, countsForFree: false },
  { code: 'SPB', name: 'Sprei Besar', category: 'SATUAN', unit: 'PCS', rate: 10000, minQty: 1, durationHours: 72, countsForFree: false },
  { code: 'SSK', name: 'Selimut Kecil', category: 'SATUAN', unit: 'PCS', rate: 10000, minQty: 1, durationHours: 72, countsForFree: false },
  { code: 'SSB', name: 'Selimut Besar', category: 'SATUAN', unit: 'PCS', rate: 15000, minQty: 1, durationHours: 72, countsForFree: false },
  { code: 'BDK', name: 'Bed Cover Kecil', category: 'SATUAN', unit: 'PCS', rate: 20000, minQty: 1, durationHours: 72, countsForFree: false },
  { code: 'BDB', name: 'Bed Cover Besar', category: 'SATUAN', unit: 'PCS', rate: 25000, minQty: 1, durationHours: 72, countsForFree: false },
  { code: 'BDJ', name: 'Bed Cover Jumbo', category: 'SATUAN', unit: 'PCS', rate: 35000, minQty: 1, durationHours: 72, countsForFree: false },
];

async function seedCore() {
  for (const [i, s] of SERVICES.entries()) {
    await prisma.service.upsert({
      where: { code: s.code },
      create: { ...s, minPrice: s.minPrice ?? null, sortOrder: i },
      update: {}, // jangan menimpa perubahan harga yang dibuat owner
    });
  }
  const ownerName = process.env.SEED_OWNER_USERNAME ?? 'owner';
  await prisma.user.upsert({
    where: { username: ownerName },
    create: { username: ownerName, name: 'Owner Djotos', role: Role.OWNER, passwordHash: await bcrypt.hash(process.env.SEED_OWNER_PASSWORD ?? 'owner123', 10) },
    update: {},
  });
  if ((await prisma.bonusRule.count()) === 0) {
    await prisma.bonusRule.createMany({
      data: [
        { name: 'Bonus per kg', type: 'PER_KG', value: 200, minTarget: 500, isActive: true },
        { name: 'Bonus omzet 1%', type: 'PERCENT_OMZET', value: 1, minTarget: 5_000_000, isActive: true },
      ],
    });
  }
}

async function seedSample() {
  if ((await prisma.order.count()) > 0) return;
  const pass = await bcrypt.hash('staff123', 10);
  const fani = await prisma.user.upsert({ where: { username: 'fani' }, create: { username: 'fani', name: 'Fani', passwordHash: pass }, update: {} });
  const ana = await prisma.user.upsert({ where: { username: 'ana' }, create: { username: 'ana', name: 'Ana', passwordHash: pass }, update: {} });

  const names = ['Dito PP', 'Ranto', 'Deby', 'P. Rudi', 'Bu Win', 'Nida', 'Tirta', 'Rifa', 'Milla', 'Arga', 'Mb. Mega', 'Elsa', 'B. Nico', 'Alma'];
  const customers: Awaited<ReturnType<typeof prisma.customer.create>>[] = [];
  for (const [i, name] of names.entries()) {
    customers.push(await prisma.customer.create({ data: { name, phone: `62812345600${String(i).padStart(2, '0')}` } }));
  }
  const byName = (n: string) => customers.find((c) => c.name === n)!;
  const svc = new Map((await prisma.service.findMany()).map((s) => [s.code, s]));

  async function addOrder(o: { c: string; staff: typeof fani; daysAgo: number; items: [string, number][]; status?: OrderStatus; pay?: PayMethod | null; partial?: number }) {
    const when = new Date(Date.now() - o.daysAgo * 86400_000 - 3600_000);
    const lines = o.items.map(([code, qty]) => ({ s: svc.get(code)!, ...calcLinePrice(svc.get(code)!, qty) }));
    const total = lines.reduce((a, l) => a + l.subtotal, 0);
    const ymd = wibDateStr(when).replace(/-/g, '').slice(2);
    const seq = await prisma.sequence.upsert({ where: { key: `inv:${ymd}` }, create: { key: `inv:${ymd}`, value: 1 }, update: { value: { increment: 1 } } });
    const paid = o.pay ? (o.partial ?? total) : 0;
    const status = o.status ?? OrderStatus.PICKED_UP;
    const order = await prisma.order.create({
      data: {
        invoiceNo: `DJ-${ymd}-${String(seq.value).padStart(3, '0')}`,
        customerId: byName(o.c).id, staffId: o.staff.id, status, subtotal: total, total, paidAmount: paid,
        paymentStatus: paid >= total ? PaymentStatus.PAID : paid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID,
        countsForFree: lines.some((l) => l.s.countsForFree), receivedAt: when, createdAt: when,
        estimatedAt: new Date(when.getTime() + 48 * 3600_000),
        finishedAt: status === 'FINISHED' || status === 'PICKED_UP' ? new Date(when.getTime() + 20 * 3600_000) : null,
        pickedUpAt: status === 'PICKED_UP' ? new Date(when.getTime() + 30 * 3600_000) : null,
        items: { create: lines.map((l) => ({ serviceId: l.s.id, code: l.s.code, name: l.s.name, unit: l.s.unit, qty: l.billedQty, unitPrice: l.s.rate, subtotal: l.subtotal })) },
      },
    });
    if (paid > 0) {
      await prisma.payment.create({ data: { orderId: order.id, method: o.pay!, amount: paid, paidAt: new Date(when.getTime() + 2 * 3600_000), receivedById: o.staff.id } });
    }
  }

  // Customer dengan progres FREE: Nida 9/9 (berhak klaim), Bu Win 8/9.
  for (let i = 0; i < 9; i++) await addOrder({ c: 'Nida', staff: i % 2 ? ana : fani, daysAgo: 28 - i * 3, items: [['CK', 4]], pay: i % 3 ? PayMethod.CASH : PayMethod.QRIS });
  for (let i = 0; i < 8; i++) await addOrder({ c: 'Bu Win', staff: fani, daysAgo: 27 - i * 3, items: [['CB', 11]], pay: PayMethod.CASH });
  // Transaksi seperti di buku September
  await addOrder({ c: 'Dito PP', staff: fani, daysAgo: 6, items: [['CK', 4]], pay: PayMethod.CASH });
  await addOrder({ c: 'Ranto', staff: ana, daysAgo: 6, items: [['CK', 3]], pay: PayMethod.QRIS });
  await addOrder({ c: 'Deby', staff: ana, daysAgo: 5, items: [['CB', 4]], pay: PayMethod.CASH });
  await addOrder({ c: 'Tirta', staff: fani, daysAgo: 5, items: [['CKX', 4]], pay: PayMethod.QRIS });
  await addOrder({ c: 'Milla', staff: fani, daysAgo: 4, items: [['CK', 6]], pay: PayMethod.CASH });
  await addOrder({ c: 'Arga', staff: ana, daysAgo: 4, items: [['CKX', 3]], pay: PayMethod.QRIS });
  await addOrder({ c: 'Mb. Mega', staff: ana, daysAgo: 3, items: [['CK', 5], ['BDK', 1]], pay: PayMethod.CASH });
  await addOrder({ c: 'Elsa', staff: fani, daysAgo: 3, items: [['CKX', 5]], pay: PayMethod.QRIS, partial: 20000 }); // cicilan
  await addOrder({ c: 'B. Nico', staff: fani, daysAgo: 2, items: [['CK', 7]], pay: null }); // belum bayar
  // Hari ini
  await addOrder({ c: 'Rifa', staff: fani, daysAgo: 0, items: [['CK', 5]], status: OrderStatus.RECEIVED, pay: null });
  await addOrder({ c: 'P. Rudi', staff: ana, daysAgo: 0, items: [['CKX', 5]], status: OrderStatus.PROCESSING, pay: PayMethod.CASH });
  await addOrder({ c: 'Alma', staff: ana, daysAgo: 0, items: [['CK', 5]], status: OrderStatus.FINISHED, pay: null });
  await addOrder({ c: 'Dito PP', staff: fani, daysAgo: 0, items: [['SSB', 1], ['CB', 3]], status: OrderStatus.FINISHED, pay: PayMethod.QRIS });

  await prisma.expense.createMany({
    data: [
      { category: 'Deterjen', description: 'Deterjen 5 kg', amount: 85000, createdById: fani.id, spentAt: new Date(Date.now() - 4 * 86400_000) },
      { category: 'Plastik', description: 'Plastik kemasan', amount: 30000, createdById: ana.id, spentAt: new Date(Date.now() - 2 * 86400_000) },
      { category: 'Listrik', description: 'Token listrik', amount: 100000, method: 'QRIS', createdById: fani.id },
    ],
  });
  console.log('Data contoh dibuat: staff fani/ana (password staff123), 14 customer, nota & pengeluaran.');
}

async function main() {
  await seedCore();
  if (process.env.SEED_SAMPLE !== 'false') await seedSample();
  console.log(`Seeder selesai. Login owner: ${process.env.SEED_OWNER_USERNAME ?? 'owner'} / ${process.env.SEED_OWNER_PASSWORD ?? 'owner123'}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
