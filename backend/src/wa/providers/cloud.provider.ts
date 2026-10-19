import { postJson, WaProvider, WaSendResult } from './wa-provider';

/**
 * WhatsApp Cloud API (Meta). Catatan: pesan teks bebas hanya terkirim bila customer pernah chat dalam 24 jam;
 * di luar itu Meta mewajibkan template pesan yang disetujui.
 */
export class CloudProvider implements WaProvider {
  readonly name = 'cloud';
  constructor(
    private token = process.env.WA_CLOUD_TOKEN ?? '',
    private phoneId = process.env.WA_CLOUD_PHONE_NUMBER_ID ?? '',
  ) {}
  isConfigured() {
    return !!this.token && !!this.phoneId;
  }
  async send(phone: string, message: string): Promise<WaSendResult> {
    if (!this.isConfigured()) return { ok: false, error: 'WA_CLOUD_TOKEN / WA_CLOUD_PHONE_NUMBER_ID belum diisi' };
    try {
      const r = await postJson(
        `https://graph.facebook.com/v20.0/${this.phoneId}/messages`,
        { Authorization: `Bearer ${this.token}` },
        { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: message } },
      );
      if (r.status < 300 && r.json?.messages?.[0]?.id) return { ok: true, providerRef: r.json.messages[0].id };
      return { ok: false, error: r.json?.error?.message ?? `HTTP ${r.status}` };
    } catch (e: any) {
      return { ok: false, error: `Gagal terhubung ke WhatsApp Cloud API: ${e.message}` };
    }
  }
}
