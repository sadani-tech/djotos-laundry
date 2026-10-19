import { Logger } from '@nestjs/common';
import { WaProvider, WaSendResult } from './wa-provider';

/** Tidak mengirim apa pun — hanya mencatat. Aman untuk pengembangan & uji coba. */
export class MockWaProvider implements WaProvider {
  readonly name = 'mock';
  private logger = new Logger('WA-mock');
  isConfigured() {
    return true;
  }
  async send(phone: string, message: string): Promise<WaSendResult> {
    this.logger.log(`(simulasi) kirim ke ${phone}: ${message.slice(0, 60).replace(/\n/g, ' ')}…`);
    return { ok: true, providerRef: `mock-${Date.now()}` };
  }
}
