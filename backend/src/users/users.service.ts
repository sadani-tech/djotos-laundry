import { Body, Controller, Get, Injectable, Module, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, OwnerOnly } from '../common/auth';
import { bad, notFound } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';

const PUBLIC_FIELDS = { id: true, username: true, name: true, role: true, isActive: true, createdAt: true } as const;

export class CreateUserDto {
  @IsString() @MinLength(2, { message: 'Nama minimal 2 huruf' }) name: string;
  @IsString() @Matches(/^[a-zA-Z0-9._-]{3,30}$/, { message: 'Username 3–30 karakter: huruf, angka, titik, strip' }) username: string;
  @IsString() @MinLength(6, { message: 'Password minimal 6 karakter' }) password: string;
  @IsOptional() @IsEnum(Role, { message: 'Peran harus OWNER atau STAFF' }) role?: Role;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ResetPasswordDto {
  @IsString() @MinLength(6, { message: 'Password minimal 6 karakter' }) password: string;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  list() {
    return this.prisma.user.findMany({ select: PUBLIC_FIELDS, orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  }

  async create(dto: CreateUserDto, actor: AuthUser) {
    const username = dto.username.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { username } })) throw bad('Username sudah dipakai, coba yang lain');
    const user = await this.prisma.user.create({
      data: { name: dto.name.trim(), username, role: dto.role ?? Role.STAFF, passwordHash: await bcrypt.hash(dto.password, 10) },
      select: PUBLIC_FIELDS,
    });
    await this.audit.log({ userId: actor.id, action: 'USER_CREATE', entity: 'User', entityId: user.id, after: user });
    return user;
  }

  async update(id: number, dto: UpdateUserDto, actor: AuthUser) {
    const before = await this.prisma.user.findUnique({ where: { id }, select: PUBLIC_FIELDS });
    if (!before) throw notFound('Akun');
    if (id === actor.id && (dto.isActive === false || (dto.role && dto.role !== Role.OWNER))) {
      throw bad('Anda tidak bisa menonaktifkan atau menurunkan akun Anda sendiri');
    }
    const user = await this.prisma.user.update({ where: { id }, data: dto, select: PUBLIC_FIELDS });
    await this.audit.log({ userId: actor.id, action: 'USER_UPDATE', entity: 'User', entityId: id, before, after: user });
    return user;
  }

  async resetPassword(id: number, dto: ResetPasswordDto, actor: AuthUser) {
    if (!(await this.prisma.user.findUnique({ where: { id } }))) throw notFound('Akun');
    await this.prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(dto.password, 10) } });
    await this.audit.log({ userId: actor.id, action: 'USER_RESET_PASSWORD', entity: 'User', entityId: id });
    return { ok: true };
  }
}

@OwnerOnly()
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get() list() {
    return this.users.list();
  }
  @Post() create(@Body() dto: CreateUserDto, @CurrentUser() u: AuthUser) {
    return this.users.create(dto, u);
  }
  @Patch(':id') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto, @CurrentUser() u: AuthUser) {
    return this.users.update(id, dto, u);
  }
  @Post(':id/reset-password') reset(@Param('id', ParseIntPipe) id: number, @Body() dto: ResetPasswordDto, @CurrentUser() u: AuthUser) {
    return this.users.resetPassword(id, dto, u);
  }
}

@Module({ controllers: [UsersController], providers: [UsersService], exports: [UsersService] })
export class UsersModule {}
