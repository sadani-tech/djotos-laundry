import { Body, Controller, Get, Injectable, Module, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsInt, IsNumber, Max, Min } from 'class-validator';
import { AuthUser, CurrentUser, OwnerOnly } from '../common/auth';
import { bad } from '../common/errors';
import { roundKg } from '../common/pricing';
import { PrismaService } from '../common/prisma.service';
import { Range, currentPeriod, isPeriodStr, monthRange, todayStr } from '../common/time';
import { IroningService } from './ironing.service';

export interface StaffStats {
  orderCount: number;
  omzet: number; // total semua nota (tidak batal)
  unpaid: number;
  kg: number;
  // Hasil setrika dari sesi kerja yang terkait dengan pesanan.
  kgWash: number;
  // Dasar bonus: hanya nota lunas & bukan FREE
  bonusOrders: number;
  bonusOmzet: number;
  bonusKg: number;
}

class RecordIroningDto {
  @IsInt() @Min(1) orderId: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(1000) kg: number;
}

@Injectable()
export class StaffStatsService {
  constructor(private prisma: PrismaService, private ironing: IroningService) {}

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
          kgWash: roundKg(kgMap.get(x.id)?.kgWash ?? 0),
        },
      ]),
    );
  }

  static empty(): StaffStats {
    return { orderCount: 0, omzet: 0, unpaid: 0, kg: 0, kgWash: 0, bonusOrders: 0, bonusOmzet: 0, bonusKg: 0 };
  }

  /** Performa semua staff aktif untuk satu bulan (Owner). */
  async performance(period: string) {
    if (!isPeriodStr(period)) throw bad('Periode harus berformat YYYY-MM');
    const [stats, users, ironing] = await Promise.all([
      this.stats(monthRange(period)),
      this.prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } }),
      this.ironing.monthlyTotals(monthRange(period)),
    ]);
    return users
      .map((u) => ({ userId: u.id, name: u.name, role: u.role, ...(stats.get(u.id) ?? StaffStatsService.empty()), kgIron: ironing.get(u.id) ?? 0 }))
      .filter((u) => u.role === Role.STAFF || u.orderCount > 0 || u.kgIron > 0)
      .sort((a, b) => b.omzet - a.omzet);
  }

  /** Hasil setrika berdasarkan waktu setiap sesi kerja. */
  dailyRecap(user: AuthUser, date: string) {
    return this.ironing.dailyRecap(user, date);
  }
}

@Controller('staff')
export class StaffController {
  constructor(private stats: StaffStatsService, private ironing: IroningService) {}

  @OwnerOnly() @Get('performance')
  performance(@Query('period') period: string = currentPeriod()) {
    return this.stats.performance(period);
  }

  @Get('daily-recap')
  daily(@CurrentUser() user: AuthUser, @Query('date') date: string = todayStr()) {
    return this.stats.dailyRecap(user, date);
  }

  @Get('ironing/pending')
  pendingIroning() {
    return this.ironing.pending();
  }

  @Post('ironing')
  recordIroning(@CurrentUser() user: AuthUser, @Body() dto: RecordIroningDto) {
    return this.ironing.record(dto.orderId, dto.kg, user);
  }
}

@Module({ controllers: [StaffController], providers: [StaffStatsService, IroningService], exports: [StaffStatsService] })
export class StaffModule {}
