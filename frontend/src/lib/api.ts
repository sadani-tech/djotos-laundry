const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const TOKEN_KEY = 'djotos_token';

export class ApiError extends Error {
  constructor(message: string, public status = 0) {
    super(message);
  }
}

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* mode privat */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* */ } },
};

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError('Tidak bisa terhubung ke server. Periksa koneksi internet lalu coba lagi.');
  }
  if (!res.ok) {
    let msg = 'Terjadi kesalahan, coba lagi.';
    try {
      const j = await res.json();
      msg = Array.isArray(j.message) ? j.message[0] : j.message || msg;
    } catch { /* bukan JSON */ }
    // Sesi habis → kembali ke halaman masuk (kecuali saat memang sedang login).
    if (res.status === 401 && !path.startsWith('/auth/login') && typeof window !== 'undefined') {
      tokenStore.clear();
      window.location.href = '/login';
    }
    throw new ApiError(msg, res.status);
  }
  return res;
}

const json = async <T,>(p: Promise<Response>): Promise<T> => (await p).json();

export const api = {
  get: <T,>(path: string) => json<T>(request(path)),
  post: <T,>(path: string, body?: unknown) => json<T>(request(path, { method: 'POST', body: JSON.stringify(body ?? {}) })),
  patch: <T,>(path: string, body?: unknown) => json<T>(request(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) })),
  put: <T,>(path: string, body?: unknown) => json<T>(request(path, { method: 'PUT', body: JSON.stringify(body ?? {}) })),
  del: <T,>(path: string) => json<T>(request(path, { method: 'DELETE' })),
  /** Unduh file (Excel) dengan token. */
  async download(path: string, filename: string) {
    const blob = await (await request(path)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export const fetcher = <T,>(path: string) => api.get<T>(path);
