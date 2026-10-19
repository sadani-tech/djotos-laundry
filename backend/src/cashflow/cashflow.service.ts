import { Injectable } from '@nestjs/common';
import { OrderStatus, PayMethod, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../common/auth';
import { bad, notFound } from '../common/errors';
import { orderView } from '../common/order-view';
import { PrismaService } from '../common/prisma.service';
import { Period, eachDay, hariName, isDateStr, periodRange, startOfWibDay, todayStr, wibDateStr } from '../common/time';
import { AuditService } from '../audit/audit.service';
import { ExcelService } from '../reports/excel.service';
import { CreateExpenseDto, UpdateExpenseDto } from './cashflow.dto';

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

@Injectable()
export class CashflowService {
  constructor(private prisma: PrismaService, private audit: AuditService, private excel: ExcelService) {}

  /** Staff hanya melihat kas yang ia terima/catat sendiri; Owner bisa semua atau filter per staff. */
  private scopeId(user: AuthUser, staffId?: number): number | undefined {
    return user.role === Role.OWNER ? staffId : user.id;
  }

  private range(period: string, date?: string) {
    if (!['day', 'week', 'month'].includes(period)) throw bad('Periode harus day, week, atau month');
    if (date && !isDateStr(date)) throw bad('Format tanggal harus YYYY-MM-DD');
    return periodRange(period as Period, date ?? todayStr());
  }

  async summary(user: AuthUser, q: { period: string; date?: string; staffId?: number }) {
    const r = this.range(q.period, q.date);
    const scope = this.scopeId(user, q.staffId);
    const [payments, expenses, receivable] = await Promise.all([
      this.prisma.payment.findMany({
        where: { voidedAt: null, paidAt: { gte: r.start, lt: r.end }, ...(scope ? { receivedById: scope } : {}) },
        select: { paidAt: true, method: true, amount: true },
      }),
      this.prisma.expense.findMany({
        where: { deletedAt: null, spentAt: { gte: r.start, lt: r.end }, ...(scope ? { createdById: scope } : {}) },
        select: { spentAt: true, method: true, amount: true, category: true },
      }),
      this.prisma.order.aggregate({
        where: { deletedAt: null, status: { not: OrderStatus.CANCELLED }, receivedAt: { gte: r.start, lt: r.end }, ...(scope ? { staffId: scope } : {}) },
        _sum: { total: true, paidAmount: true },
      }),
    ]);

    const days = new Map(eachDay(r).map((d) => [d, { date: d, hari: hariName(d), cash: 0, qris: 0, income: 0, expense: 0, net: 0 }]));
    let cash = 0, qris = 0, expCash = 0, expQris = 0;
    for (const p of payments) {
      const d = days.get(wibDateStr(p.paidAt))!;
      if (p.method === PayMethod.CASH) { cash += p.amount; d.cash += p.amount; } else { qris += p.amount; d.qris += p.amount; }
      d.income += p.amount;
    }
    const byCat = new Map<string, number>();
    for (const e of expenses) {
      const d = days.get(wibDateStr(e.spentAt))!;
      d.expense += e.amount;
      if (e.method === PayMethod.CASH) expCash += e.amount; else expQris += e.amount;
      byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
    }
    days.forEach((d) => (d.net = d.income - d.expense));
    const income = cash + qris;
    const expense = expCash + expQris;
    return {
      period: q.period,
      from: r.fromStr,
      to: r.toStr,
      scope: scope ? 'mine' : 'all',
      income: { cash, qris, total: income, cashPct: pct(cash, income), qrisPct: pct(qris, income), count: payments.length },
      expense: { total: expense, cash: expCash, qris: expQris, byCategory: [...byCat].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount) },
      net: income - expense,
      netCash: cash - expCash,
      receivable: (receivable._sum.total ?? 0) - (receivable._sum.paidAmount ?? 0),
      daily: [...days.values()],
    };
  }

  /** Daftar pemasukan + pengeluaran bercampur, terbaru di atas (untuk tampilan "buku kas"). */
  async entries(user: AuthUser, q: { period: string; date?: string; staffId?: number }) {
    const r = this.range(q.period, q.date);
    const scope = this.scopeId(user, q.staffId);
    const [payments, expenses] = await Promise.all([
      this.prisma.payment.findMany({
        where: { voidedAt: null, paidAt: { gte: r.start, lt: r.end }, ...(scope ? { receivedById: scope } : {}) },
        include: { order: { select: { id: true, invoiceNo: true, customer: { select: { name: true } } } }, receivedBy: { select: { name: true } } },
      }),
      this.prisma.expense.findMany({
        where: { deletedAt: null, spentAt: { gte: r.start, lt: r.end }, ...(scope ? { createdById: scope } : {}) },
        include: { createdBy: { select: { name: true } } },
      }),
    ]);
    return [
      ...payments.map((p) => ({
        kind: 'IN' as const, id: p.id, at: p.paidAt, method: p.method, amount: p.amount,
        title: p.order.customer.name, subtitle: p.order.invoiceNo, orderId: p.order.id, by: p.receivedBy.name,
      })),
      ...expenses.map((e) => ({
        kind: 'OUT' as const, id: e.id, at: e.spentAt, method: e.method, amount: e.amount,
        title: e.category, subtitle: e.description ?? '', orderId: null as number | null, by: e.createdBy.name,
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());
  }

  // ---------- Pengeluaran ----------

  private spentAt(date?: string): Date {
    if (!date || date === todayStr()) return new Date();
    if (!isDateStr(date)) throw bad('Format tanggal harus YYYY-MM-DD');
    return new Date(startOfWibDay(date).getTime() + 12 * 3600_000); // tengah hari WIB
  }

  async createExpense(dto: CreateExpenseDto, user: AuthUser) {
    const e = await this.prisma.expense.create({
      data: { category: dto.category.trim(), description: dto.description?.trim() || null, amount: dto.amount, method: dto.method ?? PayMethod.CASH, spentAt: this.spentAt(dto.date), createdById: user.id },
    });
    await this.audit.log({ userId: user.id, action: 'EXPENSE_CREATE', entity: 'Expense', entityId: e.id, after: e });
    return e;
  }

  private async ownedExpense(id: number, user: AuthUser) {
    const e = await this.prisma.expense.findFirst({ where: { id, deletedAt: null } });
    if (!e) throw notFound('Pengeluaran');
    if (user.role !== Role.OWNER && e.createdById !== user.id) throw bad('Anda hanya bisa mengubah pengeluaran yang Anda catat sendiri');
    return e;
  }

  async updateExpense(id: number, dto: UpdateExpenseDto, user: AuthUser) {
    const before = await this.ownedExpense(id, user);
    const { date, ...rest } = dto;
    const e = await this.prisma.expense.update({ where: { id }, data: { ...rest, ...(date ? { spentAt: this.spentAt(date) } : {}) } });
    await this.audit.log({ userId: user.id, action: 'EXPENSE_UPDATE', entity: 'Expense', entityId: id, before, after: e });
    return e;
  }

  async deleteExpense(id: number, user: AuthUser) {
    const before = await this.ownedExpense(id, user);
    await this.prisma.expense.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({ userId: user.id, action: 'EXPENSE_DELETE', entity: 'Expense', entityId: id, before });
    return { ok: true };
  }

  // ---------- Export Excel ----------

  /** Buku harian: satu baris per nota (seperti buku catatan: nama, berat, jenis, harga, Cash/QRIS/belum bayar). */
  private async book(r: ReturnType<CashflowService['range']>, scope?: number) {
    const orders = await this.prisma.order.findMany({
      where: { deletedAt: null, status: { not: OrderStatus.CANCELLED }, receivedAt: { gte: r.start, lt: r.end }, ...(scope ? { staffId: scope } : {}) },
      orderBy: { id: 'asc' },
      include: { customer: { select: { name: true } }, staff: { select: { name: true } }, items: true, payments: { where: { voidedAt: null } } },
    });
    return orders.map((o) => {
      const v = orderView(o);
      return {
        tanggal: wibDateStr(o.receivedAt), nota: o.invoiceNo, nama: o.customer.name, berat: v.kg, jenis: v.summary, harga: o.total,
        cash: o.payments.filter((p) => p.method === PayMethod.CASH).reduce((s, p) => s + p.amount, 0),
        qris: o.payments.filter((p) => p.method === PayMethod.QRIS).reduce((s, p) => s + p.amount, 0),
        belum: o.total - o.paidAmount, staff: o.staff.name, free: o.isFree ? 'FREE' : '',
      };
    });
  }

  async exportExcel(user: AuthUser, q: { period: string; date?: string; staffId?: number }) {
    const scope = this.scopeId(user, q.staffId);
    const [sum, entries, book] = await Promise.all([this.summary(user, q), this.entries(user, q), this.book(this.range(q.period, q.date), scope)]);
    const label = { day: 'Harian', week: 'Mingguan', month: 'Bulanan' }[q.period as Period];
    const title = `Cashflow ${label} Djotos Laundry — ${sum.from}${sum.from !== sum.to ? ` s/d ${sum.to}` : ''}`;
    return this.excel.build([
      {
        name: 'Ringkasan', title,
        columns: [
          { header: 'Tanggal', key: 'date', width: 13 }, { header: 'Hari', key: 'hari', width: 10 },
          { header: 'Cash', key: 'cash', width: 14, money: true }, { header: 'QRIS', key: 'qris', width: 14, money: true },
          { header: 'Total Masuk', key: 'income', width: 15, money: true }, { header: 'Keluar', key: 'expense', width: 14, money: true },
          { header: 'Bersih', key: 'net', width: 14, money: true },
        ],
        rows: sum.daily, sumKeys: ['cash', 'qris', 'income', 'expense', 'net'],
      },
      {
        name: 'Buku Harian', title: `Buku Harian — ${sum.from} s/d ${sum.to}`,
        columns: [
          { header: 'Tanggal', key: 'tanggal', width: 12 }, { header: 'No. Nota', key: 'nota', width: 16 }, { header: 'Nama', key: 'nama', width: 24 },
          { header: 'Berat (kg)', key: 'berat', width: 11, kg: true }, { header: 'Jenis', key: 'jenis', width: 22 }, { header: 'Harga', key: 'harga', width: 12, money: true },
          { header: 'Cash', key: 'cash', width: 12, money: true }, { header: 'QRIS', key: 'qris', width: 12, money: true },
          { header: 'Belum Bayar', key: 'belum', width: 13, money: true }, { header: 'Staff', key: 'staff', width: 14 }, { header: 'Ket.', key: 'free', width: 8 },
        ],
        rows: book, sumKeys: ['berat', 'harga', 'cash', 'qris', 'belum'],
      },
      {
        name: 'Pemasukan', title: 'Pembayaran Diterima',
        columns: [
          { header: 'Waktu', key: 'at', width: 18 }, { header: 'Nota', key: 'subtitle', width: 16 }, { header: 'Customer', key: 'title', width: 24 },
          { header: 'Metode', key: 'method', width: 10 }, { header: 'Jumlah', key: 'amount', width: 14, money: true }, { header: 'Diterima oleh', key: 'by', width: 16 },
        ],
        rows: entries.filter((e) => e.kind === 'IN').map((e) => ({ ...e, at: this.fmt(e.at) })), sumKeys: ['amount'],
      },
      {
        name: 'Pengeluaran', title: 'Pengeluaran',
        columns: [
          { header: 'Waktu', key: 'at', width: 18 }, { header: 'Kategori', key: 'title', width: 20 }, { header: 'Keterangan', key: 'subtitle', width: 30 },
          { header: 'Metode', key: 'method', width: 10 }, { header: 'Jumlah', key: 'amount', width: 14, money: true }, { header: 'Dicatat oleh', key: 'by', width: 16 },
        ],
        rows: entries.filter((e) => e.kind === 'OUT').map((e) => ({ ...e, at: this.fmt(e.at) })), sumKeys: ['amount'],
      },
    ]);
  }

  private fmt(d: Date) {
    return `${wibDateStr(d)} ${new Date(d.getTime() + 7 * 3600_000).toISOString().slice(11, 16)}`;
  }
}
