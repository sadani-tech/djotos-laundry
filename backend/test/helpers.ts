import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

export async function createApp(): Promise<INestApplication> {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = mod.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

export type Api = ReturnType<typeof makeApi>;

/** Pembungkus supertest dengan token. */
export function makeApi(app: INestApplication, token?: string) {
  const auth = (r: request.Test) => (token ? r.set('Authorization', `Bearer ${token}`) : r);
  const http = () => app.getHttpServer();
  return {
    get: (url: string) => auth(request(http()).get(`/api${url}`)),
    post: (url: string, body: object = {}) => auth(request(http()).post(`/api${url}`)).send(body),
    patch: (url: string, body: object = {}) => auth(request(http()).patch(`/api${url}`)).send(body),
    put: (url: string, body: object = {}) => auth(request(http()).put(`/api${url}`)).send(body),
    del: (url: string) => auth(request(http()).delete(`/api${url}`)),
  };
}

export async function login(app: INestApplication, username: string, password: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ username, password });
  return { status: res.status, token: res.body.token as string, user: res.body.user, body: res.body };
}

/** Tunggu sampai kondisi terpenuhi (untuk proses antrean yang asinkron). */
export async function waitFor<T>(fn: () => Promise<T | undefined | false>, ms = 8000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('waitFor: waktu habis');
    await new Promise((r) => setTimeout(r, 100));
  }
}
