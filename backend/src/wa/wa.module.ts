import { BullModule } from '@nestjs/bullmq';
import { Body, Controller, Get, Module, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { WaStatus, WaType } from '@prisma/client';
import { IsOptional, IsString } from 'class-validator';
import { OwnerOnly } from '../common/auth';
import { bad } from '../common/errors';
import { CloudProvider } from './providers/cloud.provider';
import { FonnteProvider } from './providers/fonnte.provider';
import { MockWaProvider } from './providers/mock.provider';
import { WablasProvider } from './providers/wablas.provider';
import { WA_PROVIDER, WaProvider } from './providers/wa-provider';
import { WaProcessor } from './wa.processor';
import { WA_QUEUE, WaService } from './wa.service';

class TestWaDto {
  @IsString() phone: string;
  @IsOptional() @IsString() message?: string;
}

@Controller('wa')
export class WaController {
  constructor(private wa: WaService) {}

  @Get('status')
  status() {
    return this.wa.status();
  }

  @Get('logs')
  logs(@Query('status') status?: WaStatus, @Query('orderId') orderId?: string, @Query('limit') limit?: string) {
    return this.wa.list({ status, orderId: orderId ? Number(orderId) : undefined, limit: Math.min(Number(limit) || 100, 300) });
  }

  @Post('logs/:id/resend')
  resend(@Param('id', ParseIntPipe) id: number) {
    return this.wa.resend(id);
  }

  @OwnerOnly()
  @Post('test')
  test(@Body() dto: TestWaDto) {
    if (!dto.phone) throw bad('Nomor tujuan wajib diisi');
    return this.wa.enqueue({ phone: dto.phone, message: dto.message || 'Tes pesan dari Djotos Laundry ✅', type: WaType.TEST });
  }
}

function createProvider(): WaProvider {
  switch ((process.env.WA_PROVIDER ?? 'mock').toLowerCase()) {
    case 'fonnte':
      return new FonnteProvider();
    case 'wablas':
      return new WablasProvider();
    case 'cloud':
      return new CloudProvider();
    default:
      return new MockWaProvider();
  }
}

export function redisConnection() {
  const u = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password || undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
  };
}

@Module({
  imports: [
    BullModule.forRoot({ connection: redisConnection() }),
    BullModule.registerQueue({ name: WA_QUEUE }),
  ],
  controllers: [WaController],
  providers: [{ provide: WA_PROVIDER, useFactory: createProvider }, WaService, WaProcessor],
  exports: [WaService],
})
export class WaModule {}
