import { postJson, WaProvider, WaSendResult } from './wa-provider';

/** https://wablas.com — header Authorization: <token>.<secret>, POST {base}/api/send-message. */
export class WablasProvider implements WaProvider {
  readonly name = 'wablas';
  constructor(
    private base = process.env.WABLAS_BASE_URL ?? 'https://solo.wablas.com',
    private token = process.env.WABLAS_TOKEN ?? '',
    private secret = process.env.WABLAS_SECRET ?? '',
  ) {}
  isConfigured() {
    return !!this.token;
  }
  async send(phone: string, message: string): Promise<WaSendResult> {
    if (!this.isConfigured()) return { ok: false, error: 'WABLAS_TOKEN belum diisi' };
    try {
      const auth = this.secret ? `${this.token}.${this.secret}` : this.token;
      const r = await postJson(`${this.base.replace(/\/$/, '')}/api/send-message`, { Authorization: auth }, { phone, message });
      if (r.json?.status === true) return { ok: true, providerRef: String(r.json?.data?.messages?.[0]?.id ?? '') };
      return { ok: false, error: r.json?.message ?? `HTTP ${r.status}` };
    } catch (e: any) {
      return { ok: false, error: `Gagal terhubung ke Wablas: ${e.message}` };
    }
  }
}
