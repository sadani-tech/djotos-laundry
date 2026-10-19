import { Body, Controller, Get, Global, Injectable, Module, Put } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser, CurrentUser, OwnerOnly } from '../common/auth';
import { bad } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface AppSettings {
  shop: { name: string; address: string; phone: string; footer: string };
  free: { threshold: number; freeKg: number; notifyReady: boolean };
  wa: { autoSendFinished: boolean; finishedTemplate: string; freeReadyTemplate: string };
  staff: { dailyTargetKg: number };
}

/** Placeholder template: {nama} {no_nota} {total} {status_bayar} {sisa} {toko} {layanan} {progres} */
export const DEFAULT_SETTINGS: AppSettings = {
  shop: {
    name: 'Djotos Laundry',
    address: '',
    phone: '',
    footer: 'Terima kasih sudah mencuci di Djotos Laundry 🙏',
  },
  free: { threshold: 9, freeKg: 3, notifyReady: true },
  wa: {
    autoSendFinished: true,
    finishedTemplate:
      'Halo kak {nama} 👋\n\nCucian kakak di {toko} (nota *{no_nota}*) sudah *SELESAI* dan siap diambil.\n\nLayanan: {layanan}\nTotal: {total}\nStatus bayar: {status_bayar}\n\nTerima kasih 🙏',
    freeReadyTemplate:
      'Halo kak {nama} 🎉\n\nSelamat! Kakak sudah mengumpulkan {progres} nota cuci di {toko}. Cuci berikutnya *GRATIS*, tinggal bilang ke kasir ya.\n\nTerima kasih 🙏',
  },
  staff: { dailyTargetKg: 50 },
};

const SECTIONS = Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[];

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async get(): Promise<AppSettings> {
    const rows = await this.prisma.setting.findMany();
    const out: any = {};
    for (const key of SECTIONS) {
      const row = rows.find((r) => r.key === key);
      out[key] = { ...DEFAULT_SETTINGS[key], ...((row?.value as object) ?? {}) };
    }
    return out as AppSettings;
  }

  async update(patch: Partial<AppSettings>, user: AuthUser): Promise<AppSettings> {
    const before = await this.get();
    for (const key of Object.keys(patch ?? {})) {
      if (!SECTIONS.includes(key as keyof AppSettings)) throw bad(`Pengaturan "${key}" tidak dikenal`);
      const section = key as keyof AppSettings;
      const merged: any = { ...before[section] };
      // Hanya terima field yang dikenal & bertipe sama dengan default.
      for (const [k, v] of Object.entries((patch as any)[section] ?? {})) {
        const def = (DEFAULT_SETTINGS[section] as any)[k];
        if (def === undefined || typeof v !== typeof def) throw bad(`Isi pengaturan ${section}.${k} tidak valid`);
        merged[k] = v;
      }
      this.validate(section, merged);
      await this.prisma.setting.upsert({
        where: { key: section },
        create: { key: section, value: merged as Prisma.InputJsonValue },
        update: { value: merged as Prisma.InputJsonValue },
      });
    }
    const after = await this.get();
    await this.audit.log({ userId: user.id, action: 'SETTINGS_UPDATE', entity: 'Setting', before, after });
    return after;
  }

  private validate(section: keyof AppSettings, v: any) {
    if (section === 'free') {
      if (!Number.isInteger(v.threshold) || v.threshold < 1) throw bad('Jumlah nota FREE minimal 1');
      if (!(v.freeKg > 0)) throw bad('Berat FREE harus lebih dari 0');
    }
    if (section === 'shop' && !String(v.name).trim()) throw bad('Nama toko tidak boleh kosong');
    if (section === 'staff' && !(v.dailyTargetKg >= 0)) throw bad('Target harian tidak valid');
  }
}

@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get()
  get() {
    return this.settings.get();
  }

  @OwnerOnly()
  @Put()
  update(@Body() body: Partial<AppSettings>, @CurrentUser() user: AuthUser) {
    return this.settings.update(body, user);
  }
}

@Global()
@Module({ controllers: [SettingsController], providers: [SettingsService], exports: [SettingsService] })
export class SettingsModule {}
