'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, tokenStore } from './api';
import type { User } from './types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  isOwner: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) { setLoading(false); return; }
    // Hanya 401 (token tidak valid/kedaluwarsa) yang membuat sesi dihapus — itu sudah ditangani di api.ts.
    // Gangguan jaringan atau API yang sedang restart (mis. saat deploy) dicoba ulang dan token tetap disimpan.
    let cancelled = false;
    const load = async () => {
      for (let attempt = 0; attempt < 4 && !cancelled; attempt++) {
        try {
          setUser(await api.get<User>('/auth/me'));
          break;
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) break;
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
      if (!cancelled) setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await api.post<{ token: string; user: User }>('/auth/login', { username, password });
    tokenStore.set(r.token);
    setUser(r.user);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    window.location.href = '/login';
  }, []);

  return <Ctx.Provider value={{ user, loading, isOwner: user?.role === 'OWNER', login, logout }}>{children}</Ctx.Provider>;
}
