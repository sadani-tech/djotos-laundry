import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.service';
import { AuthModule } from './auth/auth.module';
import { BonusModule } from './bonus/bonus.module';
import { CashflowModule } from './cashflow/cashflow.module';
import { CatalogModule } from './catalog/catalog.module';
import { PrismaModule } from './common/prisma.service';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FreeModule } from './free/free.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { SettingsModule } from './settings/settings.service';
import { StaffModule } from './staff/staff.module';
import { UsersModule } from './users/users.service';
import { WaModule } from './wa/wa.module';

@Module({
  imports: [
    PrismaModule, AuditModule, SettingsModule, AuthModule, UsersModule,
    CatalogModule, CustomersModule, OrdersModule, PaymentsModule,
    CashflowModule, DashboardModule, FreeModule, StaffModule, BonusModule, WaModule,
  ],
})
export class AppModule {}
