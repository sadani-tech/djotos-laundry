import { Controller, Get, Global, Injectable, Module, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OwnerOnly } from '../common/auth';
import { Db, PrismaService } from '../common/prisma.service';

export interface AuditEntry {
  userId?: number | null;
  action: string;
  entity: string;
  entityId?: number | null;
  before?: unknown;
  after?: unknown;
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /** Catat perubahan. Berikan `db` (tx) agar ikut transaksi pemanggil. */
  log(e: AuditEntry, db: Db = this.prisma) {
    return db.auditLog.create({
      data: {
        userId: e.userId ?? null,
        action: e.action,
        entity: e.entity,
        entityId: e.entityId ?? null,
        before: (e.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (e.after ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  list(q: { entity?: string; entityId?: number; limit: number }) {
    return this.prisma.auditLog.findMany({
      where: { entity: q.entity || undefined, entityId: q.entityId || undefined },
      orderBy: { id: 'desc' },
      take: q.limit,
      include: { user: { select: { id: true, name: true } } },
    });
  }
}

@OwnerOnly()
@Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Get()
  list(@Query('entity') entity?: string, @Query('entityId') entityId?: string, @Query('limit') limit?: string) {
    return this.audit.list({
      entity,
      entityId: entityId ? Number(entityId) : undefined,
      limit: Math.min(Number(limit) || 100, 500),
    });
  }
}

@Global()
@Module({ controllers: [AuditController], providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
