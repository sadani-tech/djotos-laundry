// Rumus harga mengikuti pricelist: tarif per kg × berat, dengan berat minimum dan (opsional) harga minimum.
export interface PricedService {
  rate: number;
  minQty: number;
  minPrice?: number | null;
  unit: 'KG' | 'PCS';
}

export interface LinePrice {
  billedQty: number; // berat yang ditagih (>= minQty)
  subtotal: number; // rupiah
}

/**
 * Contoh (pricelist): CK rate 5.000, minQty 3, minPrice 16.000
 *   3 kg -> 16.000 · 4 kg -> 20.000 · 20 kg -> 100.000
 */
export function calcLinePrice(svc: PricedService, qty: number): LinePrice {
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Jumlah harus lebih dari 0');
  const billedQty = Math.max(qty, svc.minQty);
  let subtotal = Math.round(billedQty * svc.rate);
  if (svc.minPrice != null) subtotal = Math.max(subtotal, svc.minPrice);
  return { billedQty, subtotal };
}

/** Bulatkan kg ke 2 desimal supaya penjumlahan float tidak berantakan. */
export const roundKg = (n: number) => Math.round(n * 100) / 100;
