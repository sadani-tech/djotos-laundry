import type { Service } from './types';

/** Sama persis dengan backend (src/common/pricing.ts): tarif × berat, minimal berat/harga minimum. Hanya untuk pratinjau — server menghitung ulang. */
export function linePrice(s: Pick<Service, 'rate' | 'minQty' | 'minPrice'>, qty: number) {
  const billedQty = Math.max(qty, s.minQty);
  let subtotal = Math.round(billedQty * s.rate);
  if (s.minPrice != null) subtotal = Math.max(subtotal, s.minPrice);
  return { billedQty, subtotal };
}

export const WORK_LABEL = { WASH: 'Cuci', IRON: 'Setrika', WASH_IRON: 'Cuci + Setrika', OTHER: 'Lainnya' } as const;

/** Hak FREE yang tersedia dan progres siklus berikutnya. Tahan terhadap API lama yang belum mengirim `available`/`cycle`. */
export function freeView(f: { count: number; threshold: number; available?: number; cycle?: number }) {
  return { available: f.available ?? Math.floor(f.count / f.threshold), cycle: f.cycle ?? f.count % f.threshold, threshold: f.threshold };
}

export const CATEGORY_LABEL = { REGULER: 'Reguler', EXPRESS: 'Express', SATUAN: 'Satuan' } as const;
