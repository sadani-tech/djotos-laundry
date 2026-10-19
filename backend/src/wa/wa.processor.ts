import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { WaStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PrismaService } from '../common/prisma.service';
import { WA_PROVIDER, WaProvider } from './providers/wa-provider';
import { WA_QUEUE } from './wa.service';

/** Jeda antar pesan (ms) supaya nomor WA tidak dianggap spam oleh gateway. */
const RATE_MS = Number(process.env.WA_RATE_MS ?? 1500);

@Processor(WA_QUEUE, { concurrency: 1, limiter: { max: 1, duration: RATE_MS } })
export class WaProcessor extends WorkerHost {
  private logger = new Logger(WaProcessor.name);

  constructor(private prisma: PrismaService, @Inject(WA_PROVIDER) private provider: WaProvider) {
    super();
  }

  async process(job: Job<{ logId: number }>) {
    const log = await this.prisma.waLog.findUnique({ where: { id: job.data.logId } });
    if (!log || log.status === WaStatus.SENT) return;

    const attempt = job.attemptsMade + 1;
    const isLast = attempt >= (job.opts.attempts ?? 1);
    const res = await this.provider.send(log.phone, log.message);

    if (res.ok) {
      await this.prisma.waLog.update({
        where: { id: log.id },
        data: { status: WaStatus.SENT, attempts: attempt, sentAt: new Date(), providerRef: res.providerRef, error: null },
      });
      return;
    }
    await this.prisma.waLog.update({
      where: { id: log.id },
      data: { status: isLast ? WaStatus.FAILED : WaStatus.QUEUED, attempts: attempt, error: res.error },
    });
    this.logger.warn(`WA log #${log.id} gagal (percobaan ${attempt}): ${res.error}`);
    throw new Error(res.error); // BullMQ akan mencoba ulang dengan backoff
  }
}
