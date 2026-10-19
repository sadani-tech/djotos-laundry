export interface WaSendResult {
  ok: boolean;
  providerRef?: string;
  error?: string;
}

/** Adapter gateway WhatsApp. Tambah gateway baru = buat class baru + daftarkan di wa.module.ts. */
export interface WaProvider {
  readonly name: string;
  isConfigured(): boolean;
  /** `phone` sudah dinormalisasi (62xxxxxxxxxx). Tidak boleh melempar error — kembalikan {ok:false,error}. */
  send(phone: string, message: string): Promise<WaSendResult>;
}

export const WA_PROVIDER = Symbol('WA_PROVIDER');

/** Helper: POST JSON dengan timeout 15 detik, kembalikan status + body. */
export async function postJson(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* bukan JSON */
  }
  return { status: res.status, json, text };
}
