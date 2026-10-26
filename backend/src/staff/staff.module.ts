import { Controller, Get, Injectable, Module, Query } from '@nestjs/common';
import { OrderStatus, Role } from '@prisma/client';
import { AuthUser, CurrentUser, OwnerOnly } from '../common/auth';
import { bad } from '../common/errors';
import { roundKg } from '../common/pricing';
import { PrismaService } from '../common/prisma.service';
import { Range, currentPeriod, hariName, isDateStr, isPeriodStr, monthRange, periodRange, todayStr } from '../common/time';
import { SettingsService } from '../settings/settings.service';

export interface StaffStats {
  orderCount: number;
  omzet: number; // total semua nota (tidak batal)
  unpaid: number;
  kg: number;
  // kg per proses (hanya layanan per kg). Layanan cuci+setrika sekaligus dihitung di KEDUANYA,
  // sehingga kgWash + kgIron bisa lebih besar dari kg.
  kgWash: number;
  kgIron: number;
  // Dasar bonus: hanya nota lunas & bukan FREE
  bonusOrders: number;
  bonusOmzet: number;
  bonusKg: number;
}

@Injectable()
export class StaffStatsService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  /** Statistik per staff pada rentang tanggal nota (WIB). */
  async stats(r: Range): Promise<Map<number, StaffStats>> {
    const [rows, kgs] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT o."staffId" AS id,
          COUNT(*)::int AS "orderCount",
          COALESCE(SUM(o.total),0)::int AS omzet,
          COALESCE(SUM(o.total - o."paidAmount"),0)::int AS unpaid,
          (COUNT(*) FILTER (WHERE o."paymentStatus" = 'PAID' AND NOT o."isFree"))::int AS "bonusOrders",
          COALESCE(SUM(o.total) FILTER (WHERE o."paymentStatus" = 'PAID' AND NOT o."isFree"),0)::int AS "bonusOmzet"
        FROM orders o
        WHERE o."deletedAt" IS NULL AND o.status <> 'CANCELLED' AND o."receivedAt" >= ${r.start} AND o."receivedAt" < ${r.end}
        GROUP BY o."staffId"`,
      this.prisma.$queryRaw<any[]>`
        SELECT o."staffId" AS id,
          COALESCE(SUM(i.qty),0)::float AS kg,
          COALESCE(SUM(i.qty) FILTER (WHERE i."workType" IN ('WASH', 'WASH_IRON')),0)::float AS "kgWash",
          COALESCE(SUM(i.qty) FILTER (WHERE i."workType" IN ('IRON', 'WASH_IRON')),0)::float AS "kgIron",
          COALESCE(SUM(i.qty) FILTER (WHERE o."paymentStatus" = 'PAID' AND NOT o."isFree"),0)::float AS "bonusKg"
        FROM order_items i JOIN orders o ON o.id = i."orderId"
        WHERE o."deletedAt" IS NULL AND o.status <> 'CANCELLED' AND i.unit = 'KG'
          AND o."receivedAt" >= ${r.start} AND o."receivedAt" < ${r.end}
        GROUP BY o."staffId"`,
    ]);
    const kgMap = new Map(kgs.map((k) => [k.id as number, k]));
    return new Map(
      rows.map((x) => [
        x.id as number,
        {
          orderCount: x.orderCount, omzet: x.omzet, unpaid: x.unpaid,
          bonusOrders: x.bonusOrders, bonusOmzet: x.bonusOmzet,
          kg: roundKg(kgMap.get(x.id)?.kg ?? 0), bonusKg: roundKg(kgMap.get(x.id)?.bonusKg ?? 0),
          kgWash: roundKg(kgMap.get(x.id)?.kgWash ?? 0), kgIron: roundKg(kgMap.get(x.id)?.kgIron ?? 0),
        },
      ]),
    );
  }

  static empty(): StaffStats {
    return { orderCount: 0, omzet: 0, unpaid: 0, kg: 0, kgWash: 0, kgIron: 0, bonusOrders: 0, bonusOmzet: 0, bonusKg: 0 };
  }

  /** Performa semua staff aktif untuk satu bulan (Owner). */
  async performance(period: string) {
    if (!isPeriodStr(period)) throw bad('Periode harus berformat YYYY-MM');
    const [stats, users] = await Promise.all([
      this.stats(monthRange(period)),
      this.prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } }),
    ]);
    return users
      .map((u) => ({ userId: u.id, name: u.name, role: u.role, ...(stats.get(u.id) ?? StaffStatsService.empty()) }))
      .filter((u) => u.role === Role.STAFF || u.orderCount > 0)
      .sort((a, b) => b.omzet - a.omzet);
  }

  /**
   * Rekap harian seperti buku target staff: tanggal, hari, nama, total kg, dan rincian "Customer (kg)".
   * Staff hanya melihat rekap miliknya.
   */
  async dailyRecap(user: AuthUser, date: string) {
    if (!isDateStr(date)) throw bad('Format tanggal harus YYYY-MM-DD');
    const r = periodRange('day', date);
    const [orders, cfg] = await Promise.all([
      this.prisma.order.findMany({
        where: { deletedAt: null, status: { not: OrderStatus.CANCELLED }, receivedAt: { gte: r.start, lt: r.end }, ...(user.role === Role.STAFF ? { staffId: user.id } : {}) },
        orderBy: { id: 'asc' },
        include: { items: true, customer: { select: { id: true, name: true } }, staff: { select: { id: true, name: true } } },
      }),
      this.settings.get(),
    ]);
    const byStaff = new Map<number, { userId: number; name: string; totalKg: number; kgWash: number; kgIron: number; orderCount: number; items: Map<number, { customerId: number; name: string; kg: number }> }>();
    for (const o of orders) {
      const kgItems = o.items.filter((i) => i.unit === 'KG');
      const kg = kgItems.reduce((s, i) => s + i.qty, 0);
      const of = (...t: string[]) => kgItems.filter((i) => t.includes(i.workType)).reduce((s, i) => s + i.qty, 0);
      const s = byStaff.get(o.staffId) ?? { userId: o.staffId, name: o.staff.name, totalKg: 0, kgWash: 0, kgIron: 0, orderCount: 0, items: new Map() };
      s.totalKg += kg;
      s.kgWash += of('WASH', 'WASH_IRON');
      s.kgIron += of('IRON', 'WASH_IRON');
      s.orderCount += 1;
      const it = s.items.get(o.customerId) ?? { customerId: o.customerId, name: o.customer.name, kg: 0 };
      it.kg += kg;
      s.items.set(o.customerId, it);
      byStaff.set(o.staffId, s);
    }
    return {
      date,
      hari: hariName(date),
      targetKg: cfg.staff.dailyTargetKg,
      staff: [...byStaff.values()]
        .map((s) => ({ ...s, totalKg: roundKg(s.totalKg), kgWash: roundKg(s.kgWash), kgIron: roundKg(s.kgIron), items: [...s.items.values()].map((i) => ({ ...i, kg: roundKg(i.kg) })).filter((i) => i.kg > 0) }))
        .sort((a, b) => b.totalKg - a.totalKg),
    };
  }
}

@Controller('staff')
export class StaffController {
  constructor(private stats: StaffStatsService) {}

  @OwnerOnly() @Get('performance')
  performance(@Query('period') period: string = currentPeriod()) {
    return this.stats.performance(period);
  }

  @Get('daily-recap')
  daily(@CurrentUser() user: AuthUser, @Query('date') date: string = todayStr()) {
    return this.stats.dailyRecap(user, date);
  }
}

@Module({ controllers: [StaffController], providers: [StaffStatsService], exports: [StaffStatsService] })
export class StaffModule {}
