import { Injectable, Module } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { Db, PrismaService } from '../common/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { WaModule } from '../wa/wa.module';
import { WaService } from '../wa/wa.service';

/**
 * Nota yang dihitung untuk program FREE:
 * lunas · tidak batal · tidak dihapus · bukan nota FREE · mengandung layanan "dihitung FREE" · belum dipakai klaim.
 */
export const eligibleOrderWhere = (customerId?: number): Prisma.OrderWhereInput => ({
  deletedAt: null,
  status: { not: OrderStatus.CANCELLED },
  paymentStatus: PaymentStatus.PAID,
  isFree: false,
  countsForFree: true,
  freeClaimId: null,
  ...(customerId ? { customerId } : {}),
});

export interface FreeProgress {
  count: number;
  threshold: number;
  eligible: boolean; // berhak klaim
}

@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService, private settings: SettingsService, private wa: WaService) {}

  async threshold() {
    return (await this.settings.get()).free.threshold;
  }

  async progress(customerId: number, db: Db = this.prisma): Promise<FreeProgress> {
    const [count, threshold] = await Promise.all([db.order.count({ where: eligibleOrderWhere(customerId) }), this.threshold()]);
    return { count, threshold, eligible: count >= threshold };
  }

  /** Jumlah nota terhitung untuk banyak customer sekaligus. */
  async countMap(): Promise<Map<number, number>> {
    const rows = await this.prisma.order.groupBy({ by: ['customerId'], where: eligibleOrderWhere(), _count: { _all: true } });
    return new Map(rows.map((r) => [r.customerId, r._count._all]));
  }

  /** Dipanggil setelah sebuah nota menjadi LUNAS. Kirim WA tepat saat progres mencapai ambang. */
  async onOrderPaid(order: { customerId: number; countsForFree: boolean; isFree: boolean }) {
    if (!order.countsForFree || order.isFree) return;
    const p = await this.progress(order.customerId);
    if (p.count === p.threshold) {
      const customer = await this.prisma.customer.findUnique({ where: { id: order.customerId } });
      if (customer) await this.wa.notifyFreeReady(customer, p.threshold);
    }
  }
}

@Module({ imports: [WaModule], providers: [LoyaltyService], exports: [LoyaltyService] })
export class LoyaltyModule {}
