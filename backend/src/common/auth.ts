import { CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import { PrismaService } from './prisma.service';

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: Role;
}

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
export const OwnerOnly = () => Roles(Role.OWNER);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest().user;
});

/** Guard global: semua endpoint butuh token, kecuali yang ditandai @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector, private jwt: JwtService, private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true;
    const req = ctx.switchToHttp().getRequest();
    const header: string = req.headers['authorization'] ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Silakan masuk terlebih dahulu');
    let payload: { sub: number };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Sesi habis, silakan masuk lagi');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw new UnauthorizedException('Akun tidak aktif');
    req.user = { id: user.id, username: user.username, name: user.name, role: user.role } satisfies AuthUser;
    return true;
  }
}

/** Guard global kedua: cek @Roles(). Tanpa @Roles berarti semua yang sudah login boleh. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Menu ini hanya untuk Owner');
    return true;
  }
}
