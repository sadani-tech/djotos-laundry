import { Body, Controller, Delete, Get, Module, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { AuthUser, CurrentUser, OwnerOnly } from '../common/auth';
import { LoyaltyModule } from '../loyalty/loyalty.service';
import { PaymentsModule } from '../payments/payments.module';
import { WaModule } from '../wa/wa.module';
import { CancelOrderDto, ChangeStatusDto, CreateOrderDto, UpdateOrderDto } from './orders.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthUser,
    @Query('date') date?: string,
    @Query('status') status?: string,
    @Query('payment') payment?: string,
    @Query('q') q?: string,
    @Query('mine') mine?: string,
    @Query('customerId') customerId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.orders.list(user, { date, status, payment, q, mine: mine === '1', customerId: customerId ? Number(customerId) : undefined, limit: limit ? Number(limit) : undefined });
  }

  @Post()
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.create(dto, user);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.orders.get(id, user);
  }

  @Patch(':id/status')
  status(@Param('id', ParseIntPipe) id: number, @Body() dto: ChangeStatusDto, @CurrentUser() user: AuthUser) {
    return this.orders.changeStatus(id, dto.status, user);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.update(id, dto, user);
  }

  @Post(':id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelOrderDto, @CurrentUser() user: AuthUser) {
    return this.orders.cancel(id, user, dto.reason);
  }

  @OwnerOnly() @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.orders.remove(id, user);
  }
}

@Module({
  imports: [PaymentsModule, LoyaltyModule, WaModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
