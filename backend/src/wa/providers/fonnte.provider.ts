import { postJson, WaProvider, WaSendResult } from './wa-provider';

/** https://docs.fonnte.com — header Authorization: <token>, body {target, message}. */
export class FonnteProvider implements WaProvider {
  readonly name = 'fonnte';
  constructor(private token = process.env.FONNTE_TOKEN ?? '') {}
  isConfigured() {
    return !!this.token;
  }
  async send(phone: string, message: string): Promise<WaSendResult> {
    if (!this.isConfigured()) return { ok: false, error: 'FONNTE_TOKEN belum diisi' };
    try {
      const r = await postJson('https://api.fonnte.com/send', { Authorization: this.token }, { target: phone, message, countryCode: '62' });
      if (r.json?.status === true) return { ok: true, providerRef: String(r.json.id?.[0] ?? '') };
      return { ok: false, error: r.json?.reason ?? r.json?.detail ?? `HTTP ${r.status}` };
    } catch (e: any) {
      return { ok: false, error: `Gagal terhubung ke Fonnte: ${e.message}` };
    }
  }
}
