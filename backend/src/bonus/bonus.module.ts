import { Body, Controller, Get, Injectable, Module, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { BonusRule, BonusStatus, BonusType, Prisma } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min, MinLength, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser, OwnerOnly } from '../common/auth';
import { bad, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { currentPeriod, isPeriodStr, monthRange } from '../common/time';
import { AuditService } from '../audit/audit.service';
import { StaffModule, StaffStats, StaffStatsService } from '../staff/staff.module';

export class BonusRuleDto {
  @IsOptional() @IsInt() id?: number;
  @IsString() @MinLength(2, { message: 'Nama aturan wajib diisi' }) name: string;
  @IsEnum(BonusType, { message: 'Jenis bonus harus PER_KG atau PERCENT_OMZET' }) type: BonusType;
  @IsNumber() @Min(0, { message: 'Nilai bonus tidak boleh negatif' }) value: number;
  @IsInt() @Min(0, { message: 'Target minimum tidak boleh negatif' }) minTarget: number;
  @IsBoolean() isActive: boolean;
}
export class SaveRulesDto {
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => BonusRuleDto) rules: BonusRuleDto[];
}
export class GenerateDto {
  @IsString() period: string;
}

export interface BonusLine {
  ruleId: number;
  name: string;
  type: BonusType;
  value: number;
  metric: 'KG' | 'OMZET';
  current: number; // capaian bulan ini
  minTarget: number;
  achieved: boolean;
  amount: number;
}

/** Hitung bonus satu staff dari statistik bulannya dan aturan yang aktif. Fungsi murni → mudah diuji. */
export function computeBonus(stats: Pick<StaffStats, 'bonusKg' | 'bonusOmzet'>, rules: Pick<BonusRule, 'id' | 'name' | 'type' | 'value' | 'minTarget' | 'isActive'>[]) {
  const lines: BonusLine[] = rules
    .filter((r) => r.isActive)
    .map((r) => {
      const metric = r.type === BonusType.PER_KG ? 'KG' : 'OMZET';
      const current = metric === 'KG' ? stats.bonusKg : stats.bonusOmzet;
      const achieved = current >= r.minTarget;
      const raw = r.type === BonusType.PER_KG ? current * r.value : (current * r.value) / 100;
      return { ruleId: r.id, name: r.name, type: r.type, value: r.value, metric, current, minTarget: r.minTarget, achieved, amount: achieved ? Math.round(raw) : 0 };
    });
  return { lines, amount: lines.reduce((s, l) => s + l.amount, 0) };
}

@Injectable()
export class BonusService {
  constructor(private prisma: PrismaService, private stats: StaffStatsService, private audit: AuditService) {}

  rules() {
    return this.prisma.bonusRule.findMany({ orderBy: { id: 'asc' } });
  }

  async saveRules(dto: SaveRulesDto, user: AuthUser) {
    for (const r of dto.rules) {
      if (r.type === BonusType.PERCENT_OMZET && r.value > 100) throw bad('Persen bonus tidak boleh lebih dari 100');
    }
    const before = await this.rules();
    await this.prisma.$transaction(async (tx) => {
      const keep = dto.rules.filter((r) => r.id).map((r) => r.id!);
      await tx.bonusRule.deleteMany({ where: { id: { notIn: keep } } });
      for (const r of dto.rules) {
        const data = { name: r.name.trim(), type: r.type, value: r.value, minTarget: r.minTarget, isActive: r.isActive };
        if (r.id) {
          if (!before.some((b) => b.id === r.id)) throw notFound('Aturan bonus');
          await tx.bonusRule.update({ where: { id: r.id }, data });
        } else await tx.bonusRule.create({ data });
      }
    });
    const after = await this.rules();
    await this.audit.log({ userId: user.id, action: 'BONUS_RULES_UPDATE', entity: 'BonusRule', before, after });
    return after;
  }

  private checkPeriod(period: string) {
    if (!isPeriodStr(period)) throw bad('Periode harus berformat YYYY-MM');
    return period;
  }

  /** Bonus semua staff untuk satu bulan. Bulan yang sudah ditandai "dibayar" memakai angka yang dibekukan. */
  async summary(period: string) {
    this.checkPeriod(period);
    const [stats, rules, users, records] = await Promise.all([
      this.stats.stats(monthRange(period)),
      this.rules(),
      this.prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } }),
      this.prisma.bonusRecord.findMany({ where: { period } }),
    ]);
    return users
      .filter((u) => u.role === 'STAFF' || stats.has(u.id))
      .map((u) => {
        const s = stats.get(u.id) ?? StaffStatsService.empty();
        const rec = records.find((r) => r.userId === u.id);
        const live = computeBonus(s, rules);
        const frozen = rec?.status === BonusStatus.PAID;
        return {
          userId: u.id, name: u.name, period,
          orderCount: s.bonusOrders, totalKg: s.bonusKg, omzet: s.bonusOmzet,
          amount: frozen ? rec!.amount : live.amount,
          lines: frozen ? (rec!.breakdown as unknown as BonusLine[]) : live.lines,
          record: rec ? { id: rec.id, status: rec.status, paidAt: rec.paidAt, amount: rec.amount } : null,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }

  async mine(user: AuthUser, period: string) {
    const all = await this.summary(period);
    return all.find((r) => r.userId === user.id) ?? { userId: user.id, name: user.name, period, orderCount: 0, totalKg: 0, omzet: 0, amount: 0, lines: computeBonus({ bonusKg: 0, bonusOmzet: 0 }, await this.rules()).lines, record: null };
  }

  /** Simpan snapshot bonus bulan itu. Rekap yang sudah dibayar tidak ditimpa. */
  async generate(period: string, user: AuthUser) {
    const rows = await this.summary(period);
    let saved = 0;
    for (const r of rows) {
      if (r.record?.status === BonusStatus.PAID) continue;
      const data = { orderCount: r.orderCount, totalKg: r.totalKg, omzet: r.omzet, amount: r.amount, breakdown: r.lines as unknown as Prisma.InputJsonValue };
      await this.prisma.bonusRecord.upsert({ where: { userId_period: { userId: r.userId, period } }, create: { userId: r.userId, period, ...data }, update: data });
      saved++;
    }
    await this.audit.log({ userId: user.id, action: 'BONUS_GENERATE', entity: 'BonusRecord', after: { period, saved } });
    return this.summary(period);
  }

  async pay(id: number, user: AuthUser) {
    const rec = await this.prisma.bonusRecord.findUnique({ where: { id } });
    if (!rec) throw notFound('Rekap bonus');
    if (rec.status === BonusStatus.PAID) throw bad('Bonus ini sudah ditandai dibayar');
    const upd = await this.prisma.bonusRecord.update({ where: { id }, data: { status: BonusStatus.PAID, paidAt: new Date() } });
    await this.audit.log({ userId: user.id, action: 'BONUS_PAY', entity: 'BonusRecord', entityId: id, before: { status: rec.status }, after: { status: upd.status, amount: upd.amount } });
    return upd;
  }
}

@Controller('bonus')
export class BonusController {
  constructor(private bonus: BonusService) {}

  @Get('rules') rules() {
    return this.bonus.rules();
  }
  @OwnerOnly() @Put('rules') saveRules(@Body() dto: SaveRulesDto, @CurrentUser() u: AuthUser) {
    return this.bonus.saveRules(dto, u);
  }
  @Get('me') me(@CurrentUser() u: AuthUser, @Query('period') period: string = currentPeriod()) {
    return this.bonus.mine(u, period);
  }
  @OwnerOnly() @Get('summary') summary(@Query('period') period: string = currentPeriod()) {
    return this.bonus.summary(period);
  }
  @OwnerOnly() @Post('records/generate') generate(@Body() dto: GenerateDto, @CurrentUser() u: AuthUser) {
    return this.bonus.generate(dto.period, u);
  }
  @OwnerOnly() @Patch('records/:id/pay') pay(@Param('id', ParseIntPipe) id: number, @CurrentUser() u: AuthUser) {
    return this.bonus.pay(id, u);
  }
}

@Module({ imports: [StaffModule], controllers: [BonusController], providers: [BonusService], exports: [BonusService] })
export class BonusModule {}
