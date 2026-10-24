import { Injectable, Module } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { Db, PrismaService } from '../common/prisma.service';
import { SettingsService } from '../settings/settings.service';

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

/**
 * Progres FREE satu customer. Hak FREE menumpuk tanpa kedaluwarsa:
 *  - count     : total nota terhitung yang belum dipakai klaim
 *  - available : jumlah FREE yang bisa diklaim sekarang = floor(count / threshold)
 *  - cycle     : progres menuju FREE berikutnya = count mod threshold
 *  - eligible  : true bila available >= 1
 */
export interface FreeProgress {
  count: number;
  threshold: number;
  available: number;
  cycle: number;
  eligible: boolean;
}

export const toProgress = (count: number, threshold: number): FreeProgress => ({
  count,
  threshold,
  available: Math.floor(count / threshold),
  cycle: count % threshold,
  eligible: count >= threshold,
});

@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService, private settings: SettingsService) {}

  async threshold() {
    return (await this.settings.get()).free.threshold;
  }

  async progress(customerId: number, db: Db = this.prisma): Promise<FreeProgress> {
    const [count, threshold] = await Promise.all([db.order.count({ where: eligibleOrderWhere(customerId) }), this.threshold()]);
    return toProgress(count, threshold);
  }

  /** Jumlah nota terhitung untuk banyak customer sekaligus (semua customer bila `ids` kosong). */
  async countMap(ids?: number[]): Promise<Map<number, number>> {
    const where = eligibleOrderWhere();
    if (ids) where.customerId = { in: ids };
    const rows = await this.prisma.order.groupBy({ by: ['customerId'], where, _count: { _all: true } });
    return new Map(rows.map((r) => [r.customerId, r._count._all]));
  }

  /** Tambahkan `freeAvailable` (jumlah FREE yang bisa diklaim) ke daftar baris yang punya customerId. */
  async withFreeAvailable<T extends { customerId: number }>(rows: T[]): Promise<(T & { freeAvailable: number })[]> {
    if (!rows.length) return [];
    const ids = [...new Set(rows.map((r) => r.customerId))];
    const [counts, threshold] = await Promise.all([this.countMap(ids), this.threshold()]);
    return rows.map((r) => ({ ...r, freeAvailable: Math.floor((counts.get(r.customerId) ?? 0) / threshold) }));
  }
}

@Module({ providers: [LoyaltyService], exports: [LoyaltyService] })
export class LoyaltyModule {}
