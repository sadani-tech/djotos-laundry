import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { PaymentStatus, WaStatus, WaType } from '@prisma/client';
import { Queue } from 'bullmq';
import { bad, notFound, rupiah } from '../common/errors';
import { normalizePhone } from '../common/phone';
import { PrismaService } from '../common/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { WA_PROVIDER, WaProvider } from './providers/wa-provider';

export const WA_QUEUE = 'wa';

export function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (m, key) => (key in vars ? String(vars[key]) : m));
}

@Injectable()
export class WaService {
  private logger = new Logger(WaService.name);

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
    @InjectQueue(WA_QUEUE) private queue: Queue,
    @Inject(WA_PROVIDER) public provider: WaProvider,
  ) {}

  status() {
    return { provider: this.provider.name, configured: this.provider.isConfigured() };
  }

  /** Buat log + masukkan ke antrean. Nomor kosong/tidak valid langsung dicatat gagal (tanpa antre). */
  async enqueue(p: { phone?: string | null; message: string; type: WaType; orderId?: number; customerId?: number }) {
    const phone = normalizePhone(p.phone);
    if (!phone) {
      return this.prisma.waLog.create({
        data: {
          phone: p.phone ?? '-',
          message: p.message,
          type: p.type,
          orderId: p.orderId,
          customerId: p.customerId,
          status: WaStatus.FAILED,
          error: 'Nomor WA customer kosong atau tidak valid',
        },
      });
    }
    const log = await this.prisma.waLog.create({
      data: { phone, message: p.message, type: p.type, orderId: p.orderId, customerId: p.customerId },
    });
    await this.addJob(log.id);
    return log;
  }

  private addJob(logId: number) {
    return this.queue.add(
      'send',
      { logId },
      {
        jobId: `wa-${logId}-${Date.now()}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
        removeOnFail: 200,
      },
    );
  }

  async resend(logId: number) {
    const log = await this.prisma.waLog.findUnique({ where: { id: logId } });
    if (!log) throw notFound('Log WA');
    if (log.status === WaStatus.SENT) throw bad('Pesan ini sudah terkirim');
    const phone = normalizePhone(log.phone);
    if (!phone) throw bad('Nomor WA customer kosong/tidak valid. Perbaiki nomor di data customer lalu kirim ulang dari nota.');
    const updated = await this.prisma.waLog.update({
      where: { id: logId },
      data: { status: WaStatus.QUEUED, error: null, attempts: 0, phone },
    });
    await this.addJob(logId);
    return updated;
  }

  list(q: { status?: WaStatus; orderId?: number; limit: number }) {
    return this.prisma.waLog.findMany({
      where: { status: q.status || undefined, orderId: q.orderId || undefined },
      orderBy: { id: 'desc' },
      take: q.limit,
      include: {
        order: { select: { id: true, invoiceNo: true } },
        customer: { select: { id: true, name: true } },
      },
    });
  }

  /** Dipanggil saat status nota menjadi SELESAI. Tidak mengirim ganda untuk nota yang sama. */
  async notifyFinished(orderId: number) {
    const cfg = await this.settings.get();
    if (!cfg.wa.autoSendFinished) return null;
    const dup = await this.prisma.waLog.findFirst({
      where: { orderId, type: WaType.FINISHED, status: { in: [WaStatus.QUEUED, WaStatus.SENT] } },
    });
    if (dup) return dup;
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: true },
    });
    if (!order) return null;
    const remaining = order.total - order.paidAmount;
    const statusBayar =
      order.paymentStatus === PaymentStatus.PAID
        ? 'LUNAS ✅'
        : order.paymentStatus === PaymentStatus.PARTIAL
          ? `BAYAR SEBAGIAN — sisa ${rupiah(remaining)}`
          : `BELUM BAYAR — ${rupiah(remaining)}`;
    const message = renderTemplate(cfg.wa.finishedTemplate, {
      nama: order.customer.name,
      no_nota: order.invoiceNo,
      total: rupiah(order.total),
      sisa: rupiah(remaining),
      status_bayar: statusBayar,
      toko: cfg.shop.name,
      layanan: order.items.map((i) => `${i.code} ${i.qty}${i.unit === 'KG' ? 'kg' : 'pcs'}`).join(', '),
    });
    return this.enqueue({ phone: order.customer.phone, message, type: WaType.FINISHED, orderId, customerId: order.customerId });
  }

  async notifyFreeReady(customer: { id: number; name: string; phone: string | null }, threshold: number) {
    const cfg = await this.settings.get();
    if (!cfg.free.notifyReady) return null;
    const message = renderTemplate(cfg.wa.freeReadyTemplate, {
      nama: customer.name,
      toko: cfg.shop.name,
      progres: `${threshold}/${threshold}`,
    });
    return this.enqueue({ phone: customer.phone, message, type: WaType.FREE_READY, customerId: customer.id });
  }
}
