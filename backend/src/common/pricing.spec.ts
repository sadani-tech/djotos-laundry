import { calcLinePrice, PricedService } from './pricing';
import { normalizePhone } from './phone';
import { eachDay, hariName, monthRange, periodRange, startOfWibDay, wibDateStr } from './time';

// Layanan sesuai pricelist (lihat prisma/seed.ts)
const S: Record<string, PricedService> = {
  CK: { rate: 5000, minQty: 3, minPrice: 16000, unit: 'KG' },
  ST: { rate: 4000, minQty: 3, unit: 'KG' },
  CB: { rate: 3000, minQty: 3, unit: 'KG' },
  CKX: { rate: 7000, minQty: 2, unit: 'KG' },
  STX: { rate: 6000, minQty: 2, unit: 'KG' },
  CBX: { rate: 4000, minQty: 3, unit: 'KG' },
  SPK: { rate: 8000, minQty: 1, unit: 'PCS' },
};
const price = (code: string, qty: number) => calcLinePrice(S[code], qty).subtotal;

describe('harga mengikuti pricelist PDF', () => {
  it('Reguler — Cuci Kering (CK): 3 kg = 16.000 (bukan 15.000), lalu 5.000/kg', () => {
    expect(price('CK', 3)).toBe(16000);
    expect(price('CK', 4)).toBe(20000);
    expect(price('CK', 10)).toBe(50000);
    expect(price('CK', 20)).toBe(100000);
  });
  it('Reguler — Setrika (ST) dan Cuci Basah (CB)', () => {
    expect(price('ST', 3)).toBe(12000);
    expect(price('ST', 20)).toBe(80000);
    expect(price('CB', 3)).toBe(9000);
    expect(price('CB', 11)).toBe(33000);
    expect(price('CB', 20)).toBe(60000);
  });
  it('Express — CKX, STX, CBX', () => {
    expect(price('CKX', 2)).toBe(14000);
    expect(price('CKX', 3)).toBe(21000);
    expect(price('CKX', 20)).toBe(140000);
    expect(price('STX', 2)).toBe(12000);
    expect(price('STX', 20)).toBe(120000);
    expect(price('CBX', 3)).toBe(12000);
    expect(price('CBX', 4)).toBe(16000);
    expect(price('CBX', 20)).toBe(80000);
  });
  it('di bawah minimum ditagih sebesar minimum', () => {
    expect(calcLinePrice(S.CK, 1)).toEqual({ billedQty: 3, subtotal: 16000 });
    expect(calcLinePrice(S.CKX, 1)).toEqual({ billedQty: 2, subtotal: 14000 });
  });
  it('desimal dan di atas 20 kg tetap per kg', () => {
    expect(price('CK', 4.5)).toBe(22500);
    expect(price('CK', 25)).toBe(125000);
  });
  it('satuan per pcs', () => {
    expect(price('SPK', 2)).toBe(16000);
  });
  it('menolak jumlah nol / negatif', () => {
    expect(() => calcLinePrice(S.CK, 0)).toThrow();
    expect(() => calcLinePrice(S.CK, -1)).toThrow();
  });
});

describe('normalizePhone', () => {
  it.each([
    ['081234567890', '6281234567890'],
    ['+62 812-3456-7890', '6281234567890'],
    ['6281234567890', '6281234567890'],
    ['81234567890', '6281234567890'],
  ])('%s → %s', (input, out) => expect(normalizePhone(input)).toBe(out));
  it('menolak yang tidak valid', () => {
    expect(normalizePhone('123')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });
});

describe('waktu WIB', () => {
  it('23:30 UTC sudah hari berikutnya di WIB', () => {
    expect(wibDateStr(new Date('2026-10-18T23:30:00Z'))).toBe('2026-10-19');
    expect(wibDateStr(new Date('2026-10-19T16:59:00Z'))).toBe('2026-10-19');
  });
  it('awal hari WIB = 17:00 UTC hari sebelumnya', () => {
    expect(startOfWibDay('2026-10-19').toISOString()).toBe('2026-10-18T17:00:00.000Z');
  });
  it('minggu mulai Senin (19 Okt 2026 = Senin)', () => {
    expect(hariName('2026-10-19')).toBe('Senin');
    const w = periodRange('week', '2026-10-21');
    expect([w.fromStr, w.toStr]).toEqual(['2026-10-19', '2026-10-25']);
    const sun = periodRange('week', '2026-10-25');
    expect(sun.fromStr).toBe('2026-10-19');
  });
  it('bulan & daftar hari', () => {
    const m = monthRange('2026-02');
    expect([m.fromStr, m.toStr]).toEqual(['2026-02-01', '2026-02-28']);
    expect(eachDay(m)).toHaveLength(28);
  });
});
