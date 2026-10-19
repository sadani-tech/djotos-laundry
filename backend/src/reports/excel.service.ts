import { Injectable, Module, StreamableFile } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface SheetSpec {
  name: string;
  title?: string; // baris judul di atas tabel
  columns: { header: string; key: string; width?: number; money?: boolean; kg?: boolean }[];
  rows: Record<string, unknown>[];
  /** Jumlahkan kolom-kolom ini pada baris TOTAL di bawah tabel. */
  sumKeys?: string[];
}

const RP_FMT = '#,##0';

/** Pembuat file Excel sederhana: tiap sheet = judul + tabel + (opsional) baris total. */
@Injectable()
export class ExcelService {
  async build(sheets: SheetSpec[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Djotos Laundry';
    for (const s of sheets) {
      const ws = wb.addWorksheet(s.name.slice(0, 31));
      let headerRow = 1;
      if (s.title) {
        ws.mergeCells(1, 1, 1, Math.max(s.columns.length, 1));
        ws.getCell(1, 1).value = s.title;
        ws.getCell(1, 1).font = { bold: true, size: 14 };
        headerRow = 3;
      }
      ws.getRow(headerRow).values = s.columns.map((c) => c.header);
      const hr = ws.getRow(headerRow);
      hr.font = { bold: true };
      hr.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9F2E6' } };
        cell.border = { bottom: { style: 'thin' } };
      });
      s.columns.forEach((c, i) => {
        const col = ws.getColumn(i + 1);
        col.width = c.width ?? Math.max(12, c.header.length + 2);
        if (c.money) col.numFmt = RP_FMT;
        if (c.kg) col.numFmt = '0.##';
      });
      for (const r of s.rows) ws.addRow(s.columns.map((c) => r[c.key] ?? ''));
      if (s.sumKeys?.length) {
        const total = ws.addRow(
          s.columns.map((c, i) =>
            i === 0 ? 'TOTAL' : s.sumKeys!.includes(c.key) ? s.rows.reduce((sum, r) => sum + (Number(r[c.key]) || 0), 0) : '',
          ),
        );
        total.font = { bold: true };
        total.eachCell((cell) => (cell.border = { top: { style: 'thin' } }));
      }
      ws.views = [{ state: 'frozen', ySplit: headerRow }];
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /** Bungkus buffer jadi response unduhan. */
  file(buffer: Buffer) {
    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
}

@Module({ providers: [ExcelService], exports: [ExcelService] })
export class ReportsModule {}
