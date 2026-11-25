import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/auth';
import { bad, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { roundKg } from '../common/pricing';
import { hariName, Range } from '../common/time';
import { SettingsService } from '../settings/settings.service';
import { IroningEntryDto } from './ironing.dto';

interface IroningStaff {
  userId: number;
  name: string;
  totalKg: number;
  entries: { id: number; customerName: string; kg: number }[];
  items: Map<string, { name: string; kg: number }>;
}

function workDate(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== date) {
    throw bad('Tanggal tidak valid, gunakan YYYY-MM-DD');
  }
  return value;
}

@Injectable()
export class IroningService {
  constructor(private prisma: PrismaService, private audit: AuditService, private settings: SettingsService) {}

  private scope(user: AuthUser) {
    return { deletedAt: null, ...(user.role === Role.STAFF ? { staffId: user.id } : {}) };
  }

  private async data(dto: IroningEntryDto, actor: AuthUser, existingStaffId?: number) {
    const staffId = dto.staffId ?? existingStaffId ?? actor.id;
    if (actor.role === Role.STAFF && staffId !== actor.id) throw new ForbiddenException('Hanya dapat mencatat hasil setrika sendiri');
    const staff = await this.prisma.user.findUnique({ where: { id: staffId }, select: { isActive: true } });
    if (!staff || (!staff.isActive && staffId !== existingStaffId)) throw bad('Pegawai tidak ditemukan atau tidak aktif');
    const customerName = dto.customerName.trim().replace(/\s+/g, ' ');
    if (!customerName) throw bad('Nama customer wajib diisi');
    return { staffId, workDate: workDate(dto.date), customerName, kg: dto.kg };
  }

  async create(dto: IroningEntryDto, actor: AuthUser) {
    const data = await this.data(dto, actor);
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.ironingEntry.create({ data });
      await this.audit.log({ userId: actor.id, action: 'IRONING_CREATE', entity: 'IroningEntry', entityId: entry.id, after: entry }, tx);
      return { ...entry, kg: Number(entry.kg) };
    });
  }

  async update(id: number, dto: IroningEntryDto, actor: AuthUser) {
    const before = await this.prisma.ironingEntry.findFirst({ where: { id, ...this.scope(actor) } });
    if (!before) throw notFound('Catatan setrika');
    const data = await this.data(dto, actor, before.staffId);
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.ironingEntry.update({ where: { id, ...this.scope(actor) }, data });
      await this.audit.log({ userId: actor.id, action: 'IRONING_UPDATE', entity: 'IroningEntry', entityId: id, before, after: entry }, tx);
      return { ...entry, kg: Number(entry.kg) };
    });
  }

  async remove(id: number, actor: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.ironingEntry.findFirst({ where: { id, ...this.scope(actor) } });
      if (!before) throw notFound('Catatan setrika');
      const entry = await tx.ironingEntry.update({ where: { id, ...this.scope(actor) }, data: { deletedAt: new Date() } });
      await this.audit.log({ userId: actor.id, action: 'IRONING_DELETE', entity: 'IroningEntry', entityId: id, before, after: entry }, tx);
      return { ok: true };
    });
  }

  async monthlyTotals(range: Range) {
    const rows = await this.prisma.ironingEntry.groupBy({
      by: ['staffId'],
      where: { deletedAt: null, workDate: { gte: workDate(range.fromStr), lte: workDate(range.toStr) } },
      _sum: { kg: true },
    });
    return new Map(rows.map((r) => [r.staffId, Number(r._sum.kg ?? 0)]));
  }

  async dailyRecap(user: AuthUser, date: string) {
    const day = workDate(date);
    const [entries, cfg] = await Promise.all([
      this.prisma.ironingEntry.findMany({
        where: { ...this.scope(user), workDate: day },
        include: { staff: { select: { name: true } } }, orderBy: { id: 'asc' },
      }),
      this.settings.get(),
    ]);
    const staff = new Map<number, IroningStaff>();
    for (const e of entries) {
      const s: IroningStaff = staff.get(e.staffId) ?? { userId: e.staffId, name: e.staff.name, totalKg: 0, entries: [], items: new Map() };
      const kg = Number(e.kg);
      s.totalKg += kg;
      s.entries.push({ id: e.id, customerName: e.customerName, kg });
      const key = e.customerName.toLocaleLowerCase('id-ID');
      const item = s.items.get(key) ?? { name: e.customerName, kg: 0 };
      item.kg += kg;
      s.items.set(key, item);
      staff.set(e.staffId, s);
    }
    return {
      date, hari: hariName(date), targetKg: cfg.staff.dailyTargetKg,
      totalKg: roundKg(entries.reduce((sum, e) => sum + Number(e.kg), 0)),
      staff: [...staff.values()].map((s) => ({ ...s, totalKg: roundKg(s.totalKg), items: [...s.items.values()].map((i) => ({ ...i, kg: roundKg(i.kg) })) }))
        .sort((a, b) => b.totalKg - a.totalKg || a.name.localeCompare(b.name, 'id')),
    };
  }
}
