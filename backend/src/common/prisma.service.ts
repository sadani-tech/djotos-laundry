import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

/** Klien transaksi / klien biasa — dipakai agar helper bisa jalan di dalam $transaction. */
export type Db = PrismaClient | Prisma.TransactionClient;

@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class PrismaModule {}
