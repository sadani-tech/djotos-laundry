'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, tokenStore } from './api';
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
    api.get<User>('/auth/me').then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
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
