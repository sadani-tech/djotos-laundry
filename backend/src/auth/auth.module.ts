import { Body, Controller, Get, Global, Injectable, Module, Post, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { IsString, MinLength } from 'class-validator';
import { AuthUser, CurrentUser, JwtAuthGuard, Public, RolesGuard } from '../common/auth';
import { bad } from '../common/errors';
import { PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';

export class LoginDto {
  @IsString({ message: 'Username wajib diisi' }) username: string;
  @IsString({ message: 'Password wajib diisi' }) password: string;
}

export class ChangePasswordDto {
  @IsString() oldPassword: string;
  @IsString() @MinLength(6, { message: 'Password baru minimal 6 karakter' }) newPassword: string;
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private audit: AuditService) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { username: dto.username.trim().toLowerCase() } });
    // Pesan sama untuk username salah / password salah agar tidak membocorkan akun.
    if (!user || !user.isActive || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Username atau password salah');
    }
    const token = await this.jwt.signAsync({ sub: user.id, role: user.role });
    return { token, user: { id: user.id, username: user.username, name: user.name, role: user.role } };
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!(await bcrypt.compare(dto.oldPassword, row.passwordHash))) throw bad('Password lama salah');
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 10) } });
    await this.audit.log({ userId: user.id, action: 'PASSWORD_CHANGE', entity: 'User', entityId: user.id });
    return { ok: true };
  }
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public() @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Post('change-password')
  change(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user, dto);
  }
}

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'dev-secret',
      signOptions: { expiresIn: '14d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
