'use client';
import { ErrorBox, PageHeader, Spinner } from '@/components/ui';
import { dateTimeFmt } from '@/lib/format';
import { useApi } from '@/lib/swr';

interface Audit { id: number; action: string; entity: string; entityId: number | null; before: unknown; after: unknown; createdAt: string; user: { name: string } | null }

const LABEL: Record<string, string> = {
  ORDER_CREATE: 'Nota dibuat', ORDER_CREATE_FREE: 'Nota FREE dibuat', ORDER_STATUS: 'Status nota diubah', ORDER_UPDATE: 'Nota diubah', ORDER_CANCEL: 'Nota dibatalkan', ORDER_DELETE: 'Nota dihapus',
  PAYMENT_ADD: 'Pembayaran diterima', PAYMENT_VOID: 'Pembayaran dibatalkan', FREE_CLAIM: 'Klaim FREE', SERVICE_CREATE: 'Layanan dibuat', SERVICE_UPDATE: 'Layanan diubah',
  USER_CREATE: 'Akun dibuat', USER_UPDATE: 'Akun diubah', USER_RESET_PASSWORD: 'Password direset', PASSWORD_CHANGE: 'Password diganti', SETTINGS_UPDATE: 'Pengaturan diubah',
  BONUS_RULES_UPDATE: 'Aturan bonus diubah', BONUS_GENERATE: 'Rekap bonus disimpan', BONUS_PAY: 'Bonus dibayar', EXPENSE_CREATE: 'Pengeluaran dicatat', EXPENSE_UPDATE: 'Pengeluaran diubah', EXPENSE_DELETE: 'Pengeluaran dihapus',
  CUSTOMER_CREATE: 'Customer dibuat', CUSTOMER_UPDATE: 'Customer diubah', CUSTOMER_DELETE: 'Customer dihapus',
};

export default function AuditPage() {
  const { data, error } = useApi<Audit[]>('/audit?limit=200');
  return (
    <div>
      <PageHeader title="Riwayat Perubahan" back="/lainnya" />
      {error ? <ErrorBox error={error} /> : !data ? <Spinner /> : (
        <ul className="space-y-2">
          {data.map((a) => (
            <li key={a.id} className="card p-3">
              <div className="flex justify-between gap-2"><p className="font-bold">{LABEL[a.action] ?? a.action}</p><p className="shrink-0 text-xs text-slate-500">{dateTimeFmt(a.createdAt)}</p></div>
              <p className="text-sm text-slate-500">{a.user?.name ?? 'Sistem'} · {a.entity}{a.entityId ? ` #${a.entityId}` : ''}</p>
              {a.after != null && <details><summary className="cursor-pointer text-sm text-slate-500">Detail</summary><pre className="mt-1 overflow-x-auto rounded-lg bg-slate-100 p-2 text-xs">{JSON.stringify({ sebelum: a.before, sesudah: a.after }, null, 2)}</pre></details>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
