'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, monthLabel } from '@/lib/format';

export function MonthNav({ value, onChange }: { value: string; onChange: (ym: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button onClick={() => onChange(addMonths(value, -1))} aria-label="Bulan sebelumnya" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><ChevronLeft /></button>
      <p className="flex-1 text-center text-lg font-bold">{monthLabel(value)}</p>
      <button onClick={() => onChange(addMonths(value, 1))} aria-label="Bulan berikutnya" className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm"><ChevronRight /></button>
    </div>
  );
}
