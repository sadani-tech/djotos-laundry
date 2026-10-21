'use client';
import { RotateCw, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button, Chip, Empty, ErrorBox, Field, PageHeader, Sheet, Spinner, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateTimeFmt, phoneShow } from '@/lib/format';
import { useApi } from '@/lib/swr';
import type { WaLog } from '@/lib/types';

const TYPE = { FINISHED: 'Cucian selesai', FREE_READY: 'FREE siap', MANUAL: 'Manual', TEST: 'Tes' } as const;
const FILTERS = [{ v: '', l: 'Semua' }, { v: 'FAILED', l: 'Gagal' }, { v: 'QUEUED', l: 'Menunggu' }, { v: 'SENT', l: 'Terkirim' }];

export default function WaPage() {
  const { isOwner } = useAuth();
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);
  const { run } = useAction();
  const gw = useApi<{ provider: string; configured: boolean }>('/wa/status');
  const { data, error, mutate } = useApi<WaLog[]>(`/wa/logs?${status ? `status=${status}` : ''}`, { refreshInterval: 8000 });

  const resend = async (id: number) => { if (await run(() => api.post(`/wa/logs/${id}/resend`), 'Dikirim ulang')) setTimeout(() => mutate(), 1500); };

  return (
    <div>
      <PageHeader title="Log WhatsApp" back="/lainnya" right={isOwner ? <Button size="sm" variant="secondary" onClick={() => setTesting(true)}><Send className="h-4 w-4" /> Tes</Button> : undefined} />
      {gw.data && (
        <div className={`mb-4 rounded-xl p-4 text-sm ${gw.data.provider === 'mock' ? 'bg-amber-50 text-amber-900' : gw.data.configured ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          Gateway: <b>{gw.data.provider}</b>{' '}
          {gw.data.provider === 'mock' ? '— mode simulasi, pesan TIDAK benar-benar terkirim. Atur WA_PROVIDER di server.' : gw.data.configured ? '— siap.' : '— belum dikonfigurasi (token kosong).'}
        </div>
      )}
      <div className="bleed flex gap-2 overflow-x-auto  pb-1">{FILTERS.map((f) => <Chip key={f.v} active={status === f.v} onClick={() => setStatus(f.v)} tone={f.v === 'FAILED' ? 'red' : 'brand'}>{f.l}</Chip>)}</div>
      <div className="mt-4 space-y-3">
        {error ? <ErrorBox error={error} retry={() => mutate()} /> : !data ? <Spinner /> : data.length === 0 ? <Empty title="Belum ada pesan" /> : data.map((l) => (
          <div key={l.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{l.customer?.name ?? phoneShow(l.phone)} <span className="text-xs font-normal text-slate-500">· {TYPE[l.type]}</span></p>
                <p className="text-xs text-slate-500">{dateTimeFmt(l.createdAt)}{l.order && <> · <Link href={`/order/${l.order.id}`} className="underline">{l.order.invoiceNo}</Link></>}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${l.status === 'SENT' ? 'bg-green-100 text-green-800' : l.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}>{l.status === 'SENT' ? 'Terkirim' : l.status === 'FAILED' ? 'Gagal' : 'Menunggu'}</span>
            </div>
            {l.error && <p className="mt-1 text-sm text-red-600">{l.error}</p>}
            <details className="mt-1"><summary className="cursor-pointer text-sm text-slate-500">Lihat isi pesan</summary><p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-100 p-2 text-sm">{l.message}</p></details>
            {l.status === 'FAILED' && <Button size="sm" variant="secondary" className="mt-2" onClick={() => resend(l.id)}><RotateCw className="h-4 w-4" /> Kirim ulang</Button>}
          </div>
        ))}
      </div>
      <TestSheet open={testing} onClose={() => setTesting(false)} onDone={() => { setTesting(false); setTimeout(() => mutate(), 1500); }} />
    </div>
  );
}

function TestSheet({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { run, busy } = useAction();
  const [phone, setPhone] = useState('');
  const send = async () => { if (await run(() => api.post('/wa/test', { phone }), 'Pesan tes dimasukkan ke antrean')) onDone(); };
  return (
    <Sheet open={open} onClose={onClose} title="Kirim pesan tes">
      <Field label="Nomor WA tujuan"><input className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="081234567890" /></Field>
      <Button size="lg" className="w-full" loading={busy} disabled={phone.length < 8} onClick={send}>Kirim tes</Button>
    </Sheet>
  );
}
