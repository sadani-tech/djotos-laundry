// Konfigurasi environment khusus test (dipakai global-setup & setup-env).
export const TEST_ENV = {
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgresql://djotos:djotos_secret@localhost:5432/djotos_test',
  REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1',
  JWT_SECRET: 'test-secret',
  WA_PROVIDER: 'mock',
  WA_RATE_MS: '50',
  SEED_SAMPLE: 'false',
  SEED_OWNER_USERNAME: 'owner',
  SEED_OWNER_PASSWORD: 'owner123',
};
