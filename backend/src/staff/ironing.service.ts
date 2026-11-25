import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthUser } from '../common/auth';
import { bad } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { roundKg } from '../common/pricing';
import { hariName, Range, periodRange } from '../common/time';
import { SettingsService } from '../settings/settings.service';

interface IroningEntry {
  id: number;
  orderId: number;
  invoiceNo: string;
  customerName: string;
  kg: number;
  completedAt: Date;
}

interface IroningCustomer { customerId: number; name: string; kg: number }
interface IroningStaff { userId: number; name: string; totalKg: number; entries: IroningEntry[]; items: Map<number, IroningCustomer> }
interface IroningWork {
  auditId: number;
  orderId: number;
  invoiceNo: string;
  customerId: number;
  customerName: string;
  staffId: number;
  staffName: string;
  completedAt: Date;
  kg: number;
}

function workDate(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) {
    throw bad('Tanggal tidak valid, gunakan YYYY-MM-DD');
  }
  return value;
}

@Injectable()
export class IroningService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  /**
   * Sumber rekap adalah penyelesaian tahap Setrika pada nota yang sudah ada.
   * Satu nota dihitung sekali, dari perubahan status terakhir IRONING -> FINISHED.
   */
  private completedWork(range: Range) {
    return this.prisma.$queryRaw<IroningWork[]>`
      WITH completed AS (
        SELECT DISTINCT ON (a."entityId") a.id, a."entityId" AS "orderId", a."userId" AS "staffId", a."createdAt"
        FROM audit_logs a
        WHERE a.entity = 'Order' AND a.action = 'ORDER_STATUS'
          AND a."before"->>'status' = 'IRONING'
          AND a."after"->>'status' = 'FINISHED'
        ORDER BY a."entityId", a."createdAt" DESC, a.id DESC
      )
      SELECT c.id AS "auditId", o.id AS "orderId", o."invoiceNo",
        customer.id AS "customerId", customer.name AS "customerName",
        u.id AS "staffId", u.name AS "staffName", c."createdAt" AS "completedAt",
        COALESCE(SUM(i.qty) FILTER (WHERE i.unit = 'KG' AND i."workType" IN ('IRON', 'WASH_IRON')), 0)::float AS kg
      FROM completed c
      JOIN orders o ON o.id = c."orderId"
      JOIN customers customer ON customer.id = o."customerId"
      JOIN users u ON u.id = c."staffId"
      JOIN order_items i ON i."orderId" = o.id
      WHERE c."createdAt" >= ${range.start} AND c."createdAt" < ${range.end}
      GROUP BY c.id, o.id, o."invoiceNo", customer.id, customer.name, u.id, u.name, c."createdAt"
      HAVING COALESCE(SUM(i.qty) FILTER (WHERE i.unit = 'KG' AND i."workType" IN ('IRON', 'WASH_IRON')), 0) > 0
      ORDER BY c."createdAt", o."invoiceNo"`;
  }

  async monthlyTotals(range: Range) {
    const rows = await this.completedWork(range);
    const totals = new Map<number, number>();
    for (const row of rows) totals.set(row.staffId, (totals.get(row.staffId) ?? 0) + Number(row.kg));
    return new Map([...totals].map(([staffId, kg]) => [staffId, roundKg(kg)]));
  }

  async dailyRecap(user: AuthUser, date: string) {
    workDate(date);
    const range = periodRange('day', date);
    const [allWork, cfg] = await Promise.all([this.completedWork(range), this.settings.get()]);
    const work = user.role === Role.STAFF ? allWork.filter((row) => row.staffId === user.id) : allWork;
    const staff = new Map<number, IroningStaff>();
    for (const row of work) {
      const kg = Number(row.kg);
      const s: IroningStaff = staff.get(row.staffId) ?? { userId: row.staffId, name: row.staffName, totalKg: 0, entries: [], items: new Map<number, IroningCustomer>() };
      s.totalKg += kg;
      s.entries.push({ id: row.auditId, orderId: row.orderId, invoiceNo: row.invoiceNo, customerName: row.customerName, kg, completedAt: row.completedAt });
      const item = s.items.get(row.customerId) ?? { customerId: row.customerId, name: row.customerName, kg: 0 };
      item.kg += kg;
      s.items.set(row.customerId, item);
      staff.set(row.staffId, s);
    }
    return {
      date, hari: hariName(date), targetKg: cfg.staff.dailyTargetKg,
      totalKg: roundKg(work.reduce((sum, row) => sum + Number(row.kg), 0)),
      staff: [...staff.values()].map((s) => ({ ...s, totalKg: roundKg(s.totalKg), entries: s.entries.map((e) => ({ ...e, kg: roundKg(e.kg) })), items: [...s.items.values()].map((i) => ({ ...i, kg: roundKg(i.kg) })) }))
        .sort((a, b) => b.totalKg - a.totalKg || a.name.localeCompare(b.name, 'id')),
    };
  }
}
