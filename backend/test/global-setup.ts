import { execSync } from 'child_process';
import { TEST_ENV } from './test-env';

/** Siapkan database test: migrasi → kosongkan semua tabel → seed layanan + owner. */
export default async function globalSetup() {
  const env = { ...process.env, ...TEST_ENV };
  const run = (cmd: string) => execSync(cmd, { env, stdio: 'pipe', cwd: __dirname + '/..' });
  run('npx prisma migrate deploy');
  run(`psql "${TEST_ENV.DATABASE_URL}" -c "TRUNCATE users, customers, services, orders, order_items, payments, expenses, free_claims, bonus_rules, bonus_records, wa_logs, settings, sequences, audit_logs RESTART IDENTITY CASCADE"`);
  run('npx ts-node prisma/seed.ts');
  run(`redis-cli -u "${TEST_ENV.REDIS_URL}" FLUSHDB`);
}
