import type { Service } from './types';

/** Sama persis dengan backend (src/common/pricing.ts): tarif × berat, minimal berat/harga minimum. Hanya untuk pratinjau — server menghitung ulang. */
export function linePrice(s: Pick<Service, 'rate' | 'minQty' | 'minPrice'>, qty: number) {
  const billedQty = Math.max(qty, s.minQty);
  let subtotal = Math.round(billedQty * s.rate);
  if (s.minPrice != null) subtotal = Math.max(subtotal, s.minPrice);
  return { billedQty, subtotal };
}

export const CATEGORY_LABEL = { REGULER: 'Reguler', EXPRESS: 'Express', SATUAN: 'Satuan' } as const;
