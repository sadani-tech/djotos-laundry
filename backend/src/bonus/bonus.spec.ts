import { BonusType } from '@prisma/client';
import { computeBonus } from './bonus.module';
import { renderTemplate } from '../wa/wa.service';

const rules = [
  { id: 1, name: 'Per kg', type: BonusType.PER_KG, value: 200, minTarget: 500, isActive: true },
  { id: 2, name: 'Omzet 1%', type: BonusType.PERCENT_OMZET, value: 1, minTarget: 5_000_000, isActive: true },
  { id: 3, name: 'Nonaktif', type: BonusType.PER_KG, value: 999, minTarget: 0, isActive: false },
];

describe('computeBonus', () => {
  it('kedua target tercapai → jumlahkan', () => {
    const r = computeBonus({ bonusKg: 600, bonusOmzet: 6_000_000 }, rules);
    expect(r.amount).toBe(600 * 200 + 60_000);
    expect(r.lines).toHaveLength(2); // aturan nonaktif diabaikan
  });
  it('target belum tercapai → bonus 0 untuk aturan itu', () => {
    const r = computeBonus({ bonusKg: 499, bonusOmzet: 5_000_000 }, rules);
    expect(r.lines.find((l) => l.ruleId === 1)).toMatchObject({ achieved: false, amount: 0 });
    expect(r.amount).toBe(50_000);
  });
  it('tanpa performa → 0', () => {
    expect(computeBonus({ bonusKg: 0, bonusOmzet: 0 }, rules).amount).toBe(0);
  });
});

describe('renderTemplate', () => {
  it('mengganti placeholder dan membiarkan yang tidak dikenal', () => {
    expect(renderTemplate('Halo {nama}, nota {no_nota} {xyz}', { nama: 'Bu Win', no_nota: 'DJ-1' })).toBe('Halo Bu Win, nota DJ-1 {xyz}');
  });
});
