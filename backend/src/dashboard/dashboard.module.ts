import { Controller, Get, Injectable, Module } from '@nestjs/common';
import { OrderStatus, PayMethod, PaymentStatus, Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/auth';
import { PrismaService } from '../common/prisma.service';
import { periodRange, todayStr } from '../common/time';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /** 4 angka di halaman utama. Pemasukan untuk Staff = yang ia terima sendiri. */
  async get(user: AuthUser) {
    const r = periodRange('day', todayStr());
    const mine = user.role === Role.STAFF ? user.id : undefined;
    const [ordersToday, unpaid, ready, pays] = await Promise.all([
      this.prisma.order.count({ where: { deletedAt: null, status: { not: OrderStatus.CANCELLED }, receivedAt: { gte: r.start, lt: r.end } } }),
      this.prisma.order.aggregate({
        where: { deletedAt: null, status: { not: OrderStatus.CANCELLED }, paymentStatus: { not: PaymentStatus.PAID } },
        _count: { _all: true },
        _sum: { total: true, paidAmount: true },
      }),
      this.prisma.order.count({ where: { deletedAt: null, status: OrderStatus.FINISHED } }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: { voidedAt: null, paidAt: { gte: r.start, lt: r.end }, ...(mine ? { receivedById: mine } : {}) },
        _sum: { amount: true },
      }),
    ]);
    const cash = pays.find((p) => p.method === PayMethod.CASH)?._sum.amount ?? 0;
    const qris = pays.find((p) => p.method === PayMethod.QRIS)?._sum.amount ?? 0;
    return {
      date: r.fromStr,
      ordersToday,
      unpaid: { count: unpaid._count._all, amount: (unpaid._sum.total ?? 0) - (unpaid._sum.paidAmount ?? 0) },
      ready,
      incomeToday: { cash, qris, total: cash + qris, scope: mine ? 'mine' : 'all' },
    };
  }
}

@Controller('dashboard')
export class DashboardController {
  constructor(private dashboard: DashboardService) {}
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.dashboard.get(user);
  }
}

@Module({ controllers: [DashboardController], providers: [DashboardService] })
export class DashboardModule {}
