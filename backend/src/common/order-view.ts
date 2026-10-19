import { roundKg } from './pricing';

interface ItemLike {
  code: string;
  unit: 'KG' | 'PCS';
  qty: number;
}

/** Tambahkan field turunan (sisa tagihan, total kg, ringkasan layanan) untuk ditampilkan. */
export function orderView<T extends { total: number; paidAmount: number; items: ItemLike[] }>(o: T) {
  return {
    ...o,
    balance: o.total - o.paidAmount,
    kg: roundKg(o.items.filter((i) => i.unit === 'KG').reduce((s, i) => s + i.qty, 0)),
    summary: o.items.map((i) => `${i.code} ${i.qty}${i.unit === 'KG' ? 'kg' : 'pcs'}`).join(', '),
  };
}

export const ORDER_INCLUDE = {
  customer: { select: { id: true, name: true, phone: true } },
  staff: { select: { id: true, name: true } },
  items: { orderBy: { id: 'asc' as const } },
  payments: {
    where: { voidedAt: null },
    orderBy: { id: 'asc' as const },
    include: { receivedBy: { select: { id: true, name: true } } },
  },
};
