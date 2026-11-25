import { Injectable } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth';
import { bad, notFound } from '../common/errors';
import { roundKg } from '../common/pricing';
import { PrismaService } from '../common/prisma.service';
import { hariName, Range, periodRange } from '../common/time';
import { SettingsService } from '../settings/settings.service';

const cents = (kg: number) => Math.round(kg * 100);
interface StaffRecap {
  userId: number;
  name: string;
  totalKg: number;
  entries: { id: number; orderId: number; invoiceNo: string; customerName: string; kg: number; completedAt: Date }[];
  items: Map<number, { customerId: number; name: string; kg: number }>;
}
export const ironKg = (items: { unit: string; workType: string; qty: number }[]) =>
  roundKg(items.filter((i) => i.unit === 'KG' && (i.workType === 'IRON' || i.workType === 'WASH_IRON')).reduce((sum, i) => sum + i.qty, 0));

function workDate(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) {
    throw bad('Tanggal tidak valid, gunakan YYYY-MM-DD');
  }
}

@Injectable()
export class IroningService {
  constructor(private prisma: PrismaService, private settings: SettingsService, private audit: AuditService) {}

  /** Nota yang sudah masuk tahap setrika dan masih memiliki sisa KG. */
  async pending() {
    const orders = await this.prisma.order.findMany({
      where: { status: OrderStatus.IRONING, deletedAt: null },
      orderBy: { receivedAt: 'asc' },
      select: {
        id: true, invoiceNo: true, receivedAt: true,
        customer: { select: { id: true, name: true } },
        items: { select: { unit: true, workType: true, qty: true } },
        ironingEntries: { select: { kg: true } },
      },
    });
    return orders.map((o) => {
      const totalKg = ironKg(o.items);
      const doneKg = roundKg(o.ironingEntries.reduce((sum, e) => sum + Number(e.kg), 0));
      return { orderId: o.id, invoiceNo: o.invoiceNo, receivedAt: o.receivedAt, customer: o.customer, totalKg, doneKg, remainingKg: roundKg(totalKg - doneKg) };
    }).filter((o) => o.remainingKg > 0);
  }

  /** Kunci baris nota agar input bersamaan tidak melebihi sisa KG. */
  async record(orderId: number, kg: number, user: AuthUser) {
    if (!Number.isFinite(kg) || kg <= 0 || Math.abs(cents(kg) - kg * 100) > 1e-8) throw bad('KG setrika harus lebih dari 0 dan maksimal 2 angka desimal');
    const entry = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findFirst({
        where: { id: orderId, deletedAt: null },
        include: { items: { select: { unit: true, workType: true, qty: true } } },
      });
      if (!order) throw notFound('Nota');
      if (order.status !== OrderStatus.IRONING) throw bad('Nota belum berada pada tahap Setrika');
      const total = cents(ironKg(order.items));
      if (total <= 0) throw bad('Nota tidak memiliki layanan setrika dalam KG');
      const totals = await tx.ironingEntry.aggregate({ where: { orderId }, _sum: { kg: true } });
      const remaining = total - cents(Number(totals._sum.kg ?? 0));
      if (cents(kg) > remaining) throw bad(`KG melebihi sisa setrika ${roundKg(remaining / 100)} kg`);
      const saved = await tx.ironingEntry.create({ data: { orderId, staffId: user.id, kg } });
      await this.audit.log({ userId: user.id, action: 'IRONING_RECORD', entity: 'Order', entityId: orderId, after: { kg, entryId: saved.id } }, tx);
      return saved;
    });
    return { id: entry.id, orderId, kg: Number(entry.kg), createdAt: entry.createdAt };
  }

  private work(range: Range, userId?: number) {
    return this.prisma.ironingEntry.findMany({
      where: { createdAt: { gte: range.start, lt: range.end }, staffId: userId, order: { deletedAt: null, status: { not: OrderStatus.CANCELLED } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: {
        staff: { select: { id: true, name: true } },
        order: { select: { id: true, invoiceNo: true, customer: { select: { id: true, name: true } } } },
      },
    });
  }

  async monthlyTotals(range: Range) {
    const rows = await this.work(range);
    const totals = new Map<number, number>();
    for (const row of rows) totals.set(row.staffId, (totals.get(row.staffId) ?? 0) + Number(row.kg));
    return new Map([...totals].map(([staffId, kg]) => [staffId, roundKg(kg)]));
  }

  async dailyRecap(user: AuthUser, date: string) {
    workDate(date);
    const range = periodRange('day', date);
    const [rows, cfg] = await Promise.all([this.work(range, user.role === Role.STAFF ? user.id : undefined), this.settings.get()]);
    const staff = new Map<number, StaffRecap>();
    for (const row of rows) {
      const kg = Number(row.kg);
      const s: StaffRecap = staff.get(row.staffId) ?? { userId: row.staffId, name: row.staff.name, totalKg: 0, entries: [], items: new Map() };
      s.totalKg += kg;
      s.entries.push({ id: row.id, orderId: row.orderId, invoiceNo: row.order.invoiceNo, customerName: row.order.customer.name, kg, completedAt: row.createdAt });
      const customer = row.order.customer;
      const item = s.items.get(customer.id) ?? { customerId: customer.id, name: customer.name, kg: 0 };
      item.kg += kg;
      s.items.set(customer.id, item);
      staff.set(row.staffId, s);
    }
    return {
      date, hari: hariName(date), targetKg: cfg.staff.dailyTargetKg,
      totalKg: roundKg(rows.reduce((sum, row) => sum + Number(row.kg), 0)),
      staff: [...staff.values()].map((s) => ({ ...s, totalKg: roundKg(s.totalKg), entries: s.entries.map((e) => ({ ...e, kg: roundKg(e.kg) })), items: [...s.items.values()].map((i) => ({ ...i, kg: roundKg(i.kg) })) }))
        .sort((a, b) => b.totalKg - a.totalKg || a.name.localeCompare(b.name, 'id')),
    };
  }
}
