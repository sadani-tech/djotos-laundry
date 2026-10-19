import { Body, Controller, Get, Injectable, Module, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ServiceCategory, Unit } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Min, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, OwnerOnly } from '../common/auth';
import { bad, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';

export class CreateServiceDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9]{2,6}$/, { message: 'Kode 2–6 huruf/angka, contoh: CK atau BDJ' })
  code: string;
  @IsString() @MinLength(2, { message: 'Nama layanan minimal 2 huruf' }) name: string;
  @IsEnum(ServiceCategory, { message: 'Kategori harus REGULER, EXPRESS, atau SATUAN' }) category: ServiceCategory;
  @IsEnum(Unit, { message: 'Satuan harus KG atau PCS' }) unit: Unit;
  @IsInt({ message: 'Harga harus angka bulat' }) @Min(0) rate: number;
  @IsOptional() @IsNumber() @Min(0.1, { message: 'Minimum harus lebih dari 0' }) minQty?: number;
  @IsOptional() @IsInt() @Min(0) minPrice?: number | null;
  @IsOptional() @IsInt() @Min(1) durationHours?: number;
  @IsOptional() @IsBoolean() countsForFree?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

/** Kode tidak boleh diubah (sudah tercetak di nota lama) — nonaktifkan lalu buat baru bila perlu. */
export class UpdateServiceDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsEnum(ServiceCategory) category?: ServiceCategory;
  @IsOptional() @IsEnum(Unit) unit?: Unit;
  @IsOptional() @IsInt() @Min(0) rate?: number;
  @IsOptional() @IsNumber() @Min(0.1) minQty?: number;
  @IsOptional() @IsInt() @Min(0) minPrice?: number | null;
  @IsOptional() @IsInt() @Min(1) durationHours?: number;
  @IsOptional() @IsBoolean() countsForFree?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

@Injectable()
export class CatalogService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  list(all: boolean) {
    return this.prisma.service.findMany({
      where: all ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  }

  async create(dto: CreateServiceDto, user: AuthUser) {
    if (await this.prisma.service.findUnique({ where: { code: dto.code } })) throw bad(`Kode ${dto.code} sudah dipakai`);
    if (dto.unit === Unit.PCS && dto.minQty != null && !Number.isInteger(dto.minQty)) throw bad('Minimum untuk satuan pcs harus bilangan bulat');
    const s = await this.prisma.service.create({ data: { ...dto, minQty: dto.minQty ?? 1 } });
    await this.audit.log({ userId: user.id, action: 'SERVICE_CREATE', entity: 'Service', entityId: s.id, after: s });
    return s;
  }

  async update(id: number, dto: UpdateServiceDto, user: AuthUser) {
    const before = await this.prisma.service.findUnique({ where: { id } });
    if (!before) throw notFound('Layanan');
    const s = await this.prisma.service.update({ where: { id }, data: dto });
    await this.audit.log({ userId: user.id, action: 'SERVICE_UPDATE', entity: 'Service', entityId: id, before, after: s });
    return s;
  }
}

@Controller('services')
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('all') all?: string) {
    return this.catalog.list(all === '1' && user.role === 'OWNER');
  }

  @OwnerOnly() @Post()
  create(@Body() dto: CreateServiceDto, @CurrentUser() user: AuthUser) {
    return this.catalog.create(dto, user);
  }

  @OwnerOnly() @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServiceDto, @CurrentUser() user: AuthUser) {
    return this.catalog.update(id, dto, user);
  }
}

@Module({ controllers: [CatalogController], providers: [CatalogService], exports: [CatalogService] })
export class CatalogModule {}
