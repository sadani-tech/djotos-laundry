'use client';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { PayBadge, StatusBadge, Button, useConfirm, useAction } from './ui';
import { api } from '@/lib/api';
import { rupiah, timeFmt, dateFmt, kg } from '@/lib/format';
import { refreshAll } from '@/lib/swr';
import type { Order, OrderStatus } from '@/lib/types';

/** Langkah berikutnya di alur: Diterima → Diproses → Selesai → Diambil. */
export const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string; hint: string }>> = {
  RECEIVED: { to: 'PROCESSING', label: 'Mulai Proses', hint: 'Cucian mulai dikerjakan.' },
  PROCESSING: { to: 'FINISHED', label: 'Tandai Selesai', hint: 'Customer akan otomatis dikirimi WhatsApp bahwa cucian sudah selesai.' },
  FINISHED: { to: 'PICKED_UP', label: 'Sudah Diambil', hint: 'Cucian sudah diserahkan ke customer.' },
};

/** Tombol langkah berikutnya dengan konfirmasi. Dipakai di kartu order dan halaman detail. */
export function AdvanceButton({ order, size = 'md', onDone, className }: { order: Order; size?: 'sm' | 'md' | 'lg'; onDone?: () => void; className?: string }) {
  const confirm = useConfirm();
  const { run, busy } = useAction();
  const next = NEXT_STATUS[order.status];
  if (!next) return null;
  const go = async () => {
    const unpaidWarn = next.to === 'PICKED_UP' && order.paymentStatus !== 'PAID' && !order.isFree;
    const ok = await confirm({
      title: `${next.label}?`,
      confirmText: next.label,
      message: (
        <>
          <p>Nota <b>{order.invoiceNo}</b> — {order.customer.name}</p>
          <p className="mt-1">{next.hint}</p>
          {unpaidWarn && <p className="mt-2 rounded-lg bg-red-50 p-2 font-semibold text-red-700">Perhatian: nota ini masih kurang {rupiah(order.balance)}.</p>}
        </>
      ),
    });
    if (!ok) return;
    const r = await run(() => api.patch(`/orders/${order.id}/status`, { status: next.to }), 'Status diperbarui');
    if (r) { refreshAll(); onDone?.(); }
  };
  return (
    <Button size={size} variant={next.to === 'FINISHED' ? 'primary' : 'secondary'} loading={busy} onClick={go} className={className}>
      {next.label}
    </Button>
  );
}

export function OrderCard({ order, showDate }: { order: Order; showDate?: boolean }) {
  return (
    <article className="card overflow-hidden p-0 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg">
      <Link href={`/order/${order.id}`} className="flex items-start gap-3 p-4 active:bg-slate-50">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono font-bold text-slate-600">{order.invoiceNo}</span>
            <span>·</span>
            <span>{showDate ? dateFmt(order.receivedAt, { day: 'numeric', month: 'short' }) + ' ' : ''}{timeFmt(order.receivedAt)}</span>
            <span>·</span>
            <span className="truncate">{order.staff.name}</span>
          </div>
          <p className="mt-2 truncate text-lg font-extrabold tracking-tight text-slate-950">{order.customer.name}</p>
          <p className="mt-0.5 truncate text-sm text-slate-500">{order.summary}{order.kg > 0 && order.items.length > 1 ? ` · ${kg(order.kg)}` : ''}</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusBadge status={order.status} />
            {order.status !== 'CANCELLED' && <PayBadge status={order.paymentStatus} balance={order.balance} free={order.isFree && order.total === 0} />}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 pl-1">
          <p className="whitespace-nowrap text-base font-extrabold text-slate-950 sm:text-lg">{order.isFree && order.total === 0 ? 'FREE' : rupiah(order.total)}</p>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100"><ChevronRight className="h-4 w-4 text-slate-400" /></span>
        </div>
      </Link>
      {NEXT_STATUS[order.status] && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2.5">
          <AdvanceButton order={order} size="sm" className="w-full" />
        </div>
      )}
    </article>
  );
}
