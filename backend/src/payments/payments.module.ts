import { Body, Controller, Delete, Injectable, Module, Param, ParseIntPipe, Post } from '@nestjs/common';
import { OrderStatus, PayMethod, PaymentStatus } from '@prisma/client';
import { IsEnum, IsInt, Min } from 'class-validator';
import { AuthUser, CurrentUser, OwnerOnly } from '../common/auth';
import { bad, notFound, rupiah } from '../common/errors';
import { ORDER_INCLUDE, orderView } from '../common/order-view';
import { Db, PrismaService } from '../common/prisma.service';
import { AuditService } from '../audit/audit.service';

export class AddPaymentDto {
  @IsEnum(PayMethod, { message: 'Metode bayar harus CASH atau QRIS' }) method: PayMethod;
  @IsInt({ message: 'Nominal harus angka bulat (rupiah)' }) @Min(1, { message: 'Nominal minimal Rp 1' }) amount: number;
}
export class PayFullDto {
  @IsEnum(PayMethod, { message: 'Metode bayar harus CASH atau QRIS' }) method: PayMethod;
}

export const paymentStatusOf = (total: number, paid: number): PaymentStatus =>
  paid >= total ? PaymentStatus.PAID : paid > 0 ? PaymentStatus.PARTIAL : PaymentStatus.UNPAID;

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  /** Catat pembayaran di dalam transaksi pemanggil. Mengembalikan status bayar terbaru. */
  async addInTx(db: Db, orderId: number, p: { method: PayMethod; amount: number }, userId: number) {
    const order = await db.order.findFirst({ where: { id: orderId, deletedAt: null } });
    if (!order) throw notFound('Nota');
    if (order.status === OrderStatus.CANCELLED) throw bad('Nota ini sudah dibatalkan, tidak bisa menerima pembayaran');
    const remaining = order.total - order.paidAmount;
    if (remaining <= 0) throw bad('Nota ini sudah lunas');
    if (p.amount > remaining) throw bad(`Nominal melebihi sisa tagihan (${rupiah(remaining)})`);

    const payment = await db.payment.create({ data: { orderId, method: p.method, amount: p.amount, receivedById: userId } });
    const paidAmount = order.paidAmount + p.amount;
    const paymentStatus = paymentStatusOf(order.total, paidAmount);
    await db.order.update({ where: { id: orderId }, data: { paidAmount, paymentStatus } });
    await this.audit.log(
      { userId, action: 'PAYMENT_ADD', entity: 'Order', entityId: orderId, before: { paidAmount: order.paidAmount, paymentStatus: order.paymentStatus }, after: { paidAmount, paymentStatus, method: p.method, amount: p.amount } },
      db,
    );
    return { payment, order: { ...order, paidAmount, paymentStatus }, becamePaid: paymentStatus === PaymentStatus.PAID };
  }

  async add(orderId: number, dto: AddPaymentDto, user: AuthUser) {
    const r = await this.prisma.$transaction((tx) => this.addInTx(tx, orderId, dto, user.id));
    return this.view(orderId);
  }

  /** "Tandai Lunas": bayar seluruh sisa tagihan. */
  async payFull(orderId: number, dto: PayFullDto, user: AuthUser) {
    const r = await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, deletedAt: null } });
      if (!order) throw notFound('Nota');
      return this.addInTx(tx, orderId, { method: dto.method, amount: order.total - order.paidAmount }, user.id);
    });
    return this.view(orderId);
  }

  /** Batalkan (void) satu pembayaran yang salah input. Hanya owner. */
  async void(paymentId: number, user: AuthUser) {
    const orderId = await this.prisma.$transaction(async (tx) => {
      const pay = await tx.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
      if (!pay || pay.voidedAt) throw notFound('Pembayaran');
      if (pay.order.freeClaimId) throw bad('Nota ini sudah dipakai untuk klaim FREE, pembayarannya tidak bisa dibatalkan');
      await tx.payment.update({ where: { id: paymentId }, data: { voidedAt: new Date() } });
      const paidAmount = pay.order.paidAmount - pay.amount;
      const paymentStatus = paymentStatusOf(pay.order.total, paidAmount);
      await tx.order.update({ where: { id: pay.orderId }, data: { paidAmount, paymentStatus } });
      await this.audit.log(
        { userId: user.id, action: 'PAYMENT_VOID', entity: 'Order', entityId: pay.orderId, before: { paidAmount: pay.order.paidAmount, method: pay.method, amount: pay.amount }, after: { paidAmount, paymentStatus } },
        tx,
      );
      return pay.orderId;
    });
    return this.view(orderId);
  }

  private async view(orderId: number) {
    return orderView(await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: ORDER_INCLUDE }));
  }
}

@Controller()
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post('orders/:id/payments')
  add(@Param('id', ParseIntPipe) id: number, @Body() dto: AddPaymentDto, @CurrentUser() user: AuthUser) {
    return this.payments.add(id, dto, user);
  }

  @Post('orders/:id/pay-full')
  payFull(@Param('id', ParseIntPipe) id: number, @Body() dto: PayFullDto, @CurrentUser() user: AuthUser) {
    return this.payments.payFull(id, dto, user);
  }

  @OwnerOnly() @Delete('payments/:id')
  void(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.payments.void(id, user);
  }
}

@Module({ controllers: [PaymentsController], providers: [PaymentsService], exports: [PaymentsService] })
export class PaymentsModule {}
