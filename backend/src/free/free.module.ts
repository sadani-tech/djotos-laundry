import { Body, Controller, Get, Injectable, Module, Post } from '@nestjs/common';
import { Unit } from '@prisma/client';
import { IsInt, IsNumber, Min } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/auth';
import { bad, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';
import { eligibleOrderWhere, LoyaltyModule, LoyaltyService } from '../loyalty/loyalty.service';
import { OrdersModule } from '../orders/orders.module';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';

export class ClaimFreeDto {
  @IsInt({ message: 'Pilih customer terlebih dahulu' }) customerId: number;
  @IsInt({ message: 'Pilih layanan cuci untuk FREE' }) serviceId: number;
  @IsNumber() @Min(0.1, { message: 'Berat harus lebih dari 0' }) qty: number;
}

@Injectable()
export class FreeService {
  constructor(
    private prisma: PrismaService,
    private loyalty: LoyaltyService,
    private orders: OrdersService,
    private settings: SettingsService,
    private audit: AuditService,
  ) {}

  /** Progres semua customer yang pernah punya nota terhitung, plus yang sudah berhak klaim. */
  async overview() {
    const [cfg, counts, claims] = await Promise.all([
      this.settings.get(),
      this.loyalty.countMap(),
      this.prisma.freeClaim.groupBy({ by: ['customerId'], _count: { _all: true }, _max: { claimedAt: true } }),
    ]);
    const customers = await this.prisma.customer.findMany({
      where: { deletedAt: null, id: { in: [...counts.keys()] } },
      select: { id: true, name: true, phone: true },
    });
    const claimMap = new Map(claims.map((c) => [c.customerId, c]));
    const rows = customers
      .map((c) => {
        const count = counts.get(c.id) ?? 0;
        const cl = claimMap.get(c.id);
        return { ...c, count, threshold: cfg.free.threshold, eligible: count >= cfg.free.threshold, claimedTimes: cl?._count._all ?? 0, lastClaimAt: cl?._max.claimedAt ?? null };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    return {
      threshold: cfg.free.threshold,
      freeKg: cfg.free.freeKg,
      ready: rows.filter((r) => r.eligible),
      progress: rows.filter((r) => !r.eligible),
    };
  }

  claims() {
    return this.prisma.freeClaim.findMany({
      orderBy: { id: 'desc' },
      take: 100,
      include: {
        customer: { select: { id: true, name: true } },
        claimedBy: { select: { id: true, name: true } },
        order: { select: { id: true, invoiceNo: true, total: true } },
      },
    });
  }

  /**
   * Klaim FREE: buat nota bernilai Rp 0 (kelebihan di atas berat FREE ditagih normal),
   * lalu "pakai" N nota tertua supaya counter kembali ke 0 (sisa lebih dari N tetap tersimpan).
   */
  async claim(dto: ClaimFreeDto, user: AuthUser) {
    const cfg = await this.settings.get();
    const { threshold, freeKg } = cfg.free;
    const svc = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
    if (!svc || !svc.isActive) throw notFound('Layanan');
    if (svc.unit !== Unit.KG) throw bad('FREE hanya untuk layanan per kg');

    const orderId = await this.prisma.$transaction(async (tx) => {
      // Kunci baris customer agar dua kasir tidak bisa klaim bersamaan.
      await tx.$queryRaw`SELECT id FROM customers WHERE id = ${dto.customerId} FOR UPDATE`;
      const eligible = await tx.order.findMany({ where: eligibleOrderWhere(dto.customerId), orderBy: { id: 'asc' }, select: { id: true } });
      if (eligible.length < threshold) throw bad(`Belum berhak FREE: baru ${eligible.length}/${threshold} nota`);

      const order = await this.orders.createInTx(tx, {
        customerId: dto.customerId,
        staffId: user.id,
        items: [{ serviceId: dto.serviceId, qty: dto.qty }],
        isFree: true,
        note: `FREE — hadiah ${threshold} nota cuci`,
        // Berat ≤ jatah FREE: gratis penuh. Lebih dari itu: hanya jatah freeKg yang digratiskan.
        autoDiscount: (lines, subtotal) => {
          const l = lines[0];
          return l.qty <= freeKg ? subtotal : Math.min(subtotal, Math.round(freeKg * l.unitPrice));
        },
      });
      const claim = await tx.freeClaim.create({ data: { customerId: dto.customerId, orderId: order.id, claimedById: user.id } });
      const used = eligible.slice(0, threshold).map((o) => o.id);
      const upd = await tx.order.updateMany({ where: { id: { in: used }, freeClaimId: null }, data: { freeClaimId: claim.id } });
      if (upd.count !== threshold) throw bad('Data nota berubah saat klaim, silakan coba lagi');
      await this.audit.log({ userId: user.id, action: 'FREE_CLAIM', entity: 'FreeClaim', entityId: claim.id, after: { customerId: dto.customerId, orderId: order.id, used } }, tx);
      return order.id;
    });
    return this.orders.get(orderId);
  }
}

@Controller('free')
export class FreeController {
  constructor(private free: FreeService) {}

  @Get() overview() {
    return this.free.overview();
  }
  @Get('claims') claims() {
    return this.free.claims();
  }
  @Post('claim') claim(@Body() dto: ClaimFreeDto, @CurrentUser() user: AuthUser) {
    return this.free.claim(dto, user);
  }
}

@Module({ imports: [LoyaltyModule, OrdersModule], controllers: [FreeController], providers: [FreeService] })
export class FreeModule {}
