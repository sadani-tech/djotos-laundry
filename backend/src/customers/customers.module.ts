import { Body, Controller, Delete, Get, Injectable, Module, Param, ParseIntPipe, Patch, Post, Query, Res } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { IsOptional, IsString, MinLength } from 'class-validator';
import type { Response } from 'express';
import { AuthUser, CurrentUser, OwnerOnly } from '../common/auth';
import { bad, notFound } from '../common/errors';
import { ORDER_INCLUDE, orderView } from '../common/order-view';
import { normalizePhone } from '../common/phone';
import { roundKg } from '../common/pricing';
import { PrismaService } from '../common/prisma.service';
import { wibDateStr } from '../common/time';
import { AuditService } from '../audit/audit.service';
import { LoyaltyModule, LoyaltyService, toProgress } from '../loyalty/loyalty.service';
import { ExcelService, ReportsModule } from '../reports/excel.service';

export class CustomerDto {
  @IsString() @MinLength(2, { message: 'Nama customer minimal 2 huruf' }) name: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() note?: string;
}
export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() note?: string;
}

interface Recap {
  orderCount: number;
  totalKg: number;
  totalSpent: number;
  unpaid: number;
  lastOrderAt: Date | null;
}
const EMPTY_RECAP: Recap = { orderCount: 0, totalKg: 0, totalSpent: 0, unpaid: 0, lastOrderAt: null };

@Injectable()
export class CustomersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private loyalty: LoyaltyService,
    private excel: ExcelService,
  ) {}

  /** Rekap per customer (nota tidak batal & tidak dihapus). */
  private async recapMap(customerId?: number): Promise<Map<number, Recap>> {
    const only = customerId ? Prisma.sql`AND o."customerId" = ${customerId}` : Prisma.empty;
    const [stats, kgs] = await Promise.all([
      this.prisma.$queryRaw<any[]>`
        SELECT o."customerId" AS id, COUNT(*)::int AS "orderCount",
               COALESCE(SUM(o.total),0)::int AS "totalSpent",
               COALESCE(SUM(o.total - o."paidAmount"),0)::int AS unpaid,
               MAX(o."receivedAt") AS "lastOrderAt"
        FROM orders o
        WHERE o."deletedAt" IS NULL AND o.status <> 'CANCELLED' ${only}
        GROUP BY o."customerId"`,
      this.prisma.$queryRaw<any[]>`
        SELECT o."customerId" AS id, COALESCE(SUM(i.qty),0)::float AS kg
        FROM order_items i JOIN orders o ON o.id = i."orderId"
        WHERE o."deletedAt" IS NULL AND o.status <> 'CANCELLED' AND i.unit = 'KG' ${only}
        GROUP BY o."customerId"`,
    ]);
    const kgMap = new Map(kgs.map((r) => [r.id as number, r.kg as number]));
    return new Map(
      stats.map((r) => [
        r.id as number,
        { orderCount: r.orderCount, totalSpent: r.totalSpent, unpaid: r.unpaid, lastOrderAt: r.lastOrderAt, totalKg: roundKg(kgMap.get(r.id) ?? 0) },
      ]),
    );
  }

  /** Daftar customer + rekap + progres FREE. */
  async list(q: { q?: string; unpaid?: boolean; sort?: string }) {
    const search = q.q?.trim();
    const [customers, recap, free, threshold] = await Promise.all([
      this.prisma.customer.findMany({
        where: {
          deletedAt: null,
          ...(search
            ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { phone: { contains: search.replace(/\D/g, '') || '__none__' } }] }
            : {}),
        },
      }),
      this.recapMap(),
      this.loyalty.countMap(),
      this.loyalty.threshold(),
    ]);
    let rows = customers.map((c) => {
      const r = recap.get(c.id) ?? EMPTY_RECAP;
      const count = free.get(c.id) ?? 0;
      return { ...c, ...r, free: toProgress(count, threshold) };
    });
    if (q.unpaid) rows = rows.filter((r) => r.unpaid > 0);
    const sorters: Record<string, (a: any, b: any) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      recent: (a, b) => (b.lastOrderAt?.getTime() ?? 0) - (a.lastOrderAt?.getTime() ?? 0),
      spent: (a, b) => b.totalSpent - a.totalSpent,
      unpaid: (a, b) => b.unpaid - a.unpaid,
    };
    return rows.sort(sorters[q.sort ?? 'recent'] ?? sorters.recent);
  }

  async detail(id: number) {
    const customer = await this.prisma.customer.findFirst({ where: { id, deletedAt: null } });
    if (!customer) throw notFound('Customer');
    const [recap, free, orders, claims] = await Promise.all([
      this.recapMap(id),
      this.loyalty.progress(id),
      this.prisma.order.findMany({ where: { customerId: id, deletedAt: null }, orderBy: { id: 'desc' }, take: 200, include: ORDER_INCLUDE }),
      this.prisma.freeClaim.findMany({ where: { customerId: id }, orderBy: { id: 'desc' }, include: { order: { select: { invoiceNo: true } } } }),
    ]);
    return { ...customer, ...(recap.get(id) ?? EMPTY_RECAP), free, orders: orders.map(orderView), claims };
  }

  private phoneOrThrow(phone?: string) {
    if (!phone?.trim()) return null;
    const p = normalizePhone(phone);
    if (!p) throw bad('Nomor WA tidak valid. Contoh yang benar: 081234567890');
    return p;
  }

  async create(dto: CustomerDto, user: AuthUser) {
    const phone = this.phoneOrThrow(dto.phone);
    if (phone) {
      const existing = await this.prisma.customer.findUnique({ where: { phone } });
      if (existing && !existing.deletedAt) throw bad(`Nomor ini sudah terdaftar atas nama "${existing.name}"`);
      if (existing) {
        // Customer lama yang pernah dihapus — aktifkan lagi.
        return this.prisma.customer.update({ where: { id: existing.id }, data: { deletedAt: null, name: dto.name.trim(), address: dto.address, note: dto.note } });
      }
    }
    const c = await this.prisma.customer.create({ data: { name: dto.name.trim(), phone, address: dto.address, note: dto.note } });
    await this.audit.log({ userId: user.id, action: 'CUSTOMER_CREATE', entity: 'Customer', entityId: c.id, after: c });
    return c;
  }

  async update(id: number, dto: UpdateCustomerDto, user: AuthUser) {
    const before = await this.prisma.customer.findFirst({ where: { id, deletedAt: null } });
    if (!before) throw notFound('Customer');
    const data: Prisma.CustomerUpdateInput = { name: dto.name?.trim(), address: dto.address, note: dto.note };
    if (dto.phone !== undefined) {
      const phone = this.phoneOrThrow(dto.phone);
      if (phone) {
        const other = await this.prisma.customer.findUnique({ where: { phone } });
        if (other && other.id !== id) throw bad(`Nomor ini sudah dipakai customer "${other.name}"`);
      }
      data.phone = phone;
    }
    const c = await this.prisma.customer.update({ where: { id }, data });
    await this.audit.log({ userId: user.id, action: 'CUSTOMER_UPDATE', entity: 'Customer', entityId: id, before, after: c });
    return c;
  }

  async remove(id: number, user: AuthUser) {
    const c = await this.prisma.customer.findFirst({ where: { id, deletedAt: null } });
    if (!c) throw notFound('Customer');
    const open = await this.prisma.order.count({ where: { customerId: id, deletedAt: null, status: { notIn: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED] } } });
    if (open) throw bad('Customer masih punya nota yang belum selesai/diambil');
    await this.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ userId: user.id, action: 'CUSTOMER_DELETE', entity: 'Customer', entityId: id, before: c });
    return { ok: true };
  }

  /** Excel rekapan customer (format mengikuti buku rekapan). */
  async exportExcel() {
    const rows = await this.list({ sort: 'name' });
    return this.excel.build([
      {
        name: 'Rekapan Customer',
        title: `Rekapan Customer Djotos Laundry — per ${wibDateStr(new Date())}`,
        columns: [
          { header: 'Nama', key: 'name', width: 26 },
          { header: 'No. WA', key: 'phone', width: 16 },
          { header: 'Jumlah Nota', key: 'orderCount', width: 13 },
          { header: 'Total Kg', key: 'totalKg', width: 11, kg: true },
          { header: 'Total Belanja (Rp)', key: 'totalSpent', width: 18, money: true },
          { header: 'Belum Bayar (Rp)', key: 'unpaid', width: 18, money: true },
          { header: 'Terakhir Cuci', key: 'last', width: 15 },
          { header: 'Progres FREE', key: 'free', width: 14 },
        ],
        rows: rows.map((r) => ({
          ...r,
          last: r.lastOrderAt ? wibDateStr(r.lastOrderAt) : '-',
          free: `${r.free.count}/${r.free.threshold}`,
        })),
        sumKeys: ['orderCount', 'totalKg', 'totalSpent', 'unpaid'],
      },
    ]);
  }
}

@Controller('customers')
export class CustomersController {
  constructor(private customers: CustomersService, private excel: ExcelService) {}

  @Get()
  list(@Query('q') q?: string, @Query('unpaid') unpaid?: string, @Query('sort') sort?: string) {
    return this.customers.list({ q, unpaid: unpaid === '1', sort });
  }

  @Get('export')
  async export(@Res({ passthrough: true }) res: Response) {
    const buf = await this.customers.exportExcel();
    res.setHeader('Content-Disposition', `attachment; filename="rekapan-customer-${wibDateStr(new Date())}.xlsx"`);
    return this.excel.file(buf);
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.customers.detail(id);
  }

  @Post()
  create(@Body() dto: CustomerDto, @CurrentUser() user: AuthUser) {
    return this.customers.create(dto, user);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto, @CurrentUser() user: AuthUser) {
    return this.customers.update(id, dto, user);
  }

  @OwnerOnly() @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.customers.remove(id, user);
  }
}

@Module({
  imports: [LoyaltyModule, ReportsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
