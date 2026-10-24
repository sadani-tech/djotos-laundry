import { Injectable } from '@nestjs/common';
import { OrderStatus, PaymentStatus, Prisma, Role, Unit } from '@prisma/client';
import { AuthUser } from '../common/auth';
import { bad, notFound, rupiah } from '../common/errors';
import { ORDER_INCLUDE, orderView } from '../common/order-view';
import { calcLinePrice } from '../common/pricing';
import { Db, PrismaService } from '../common/prisma.service';
import { periodRange, wibDateStr } from '../common/time';
import { AuditService } from '../audit/audit.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PaymentsService, paymentStatusOf } from '../payments/payments.module';
import { WaService } from '../wa/wa.service';
import { CreateOrderDto, UpdateOrderDto } from './orders.dto';

/** Urutan status maju. CANCELLED ditangani terpisah. */
const FLOW: OrderStatus[] = [OrderStatus.RECEIVED, OrderStatus.PROCESSING, OrderStatus.FINISHED, OrderStatus.PICKED_UP];

export interface NewOrderInput {
  customerId: number;
  staffId: number;
  items: { serviceId: number; qty: number }[];
  discount?: number;
  note?: string;
  isFree?: boolean;
  /** Potongan otomatis (mis. klaim FREE) — dihitung setelah subtotal diketahui. */
  autoDiscount?: (lines: { serviceId: number; qty: number; unitPrice: number; subtotal: number }[], subtotal: number) => number;
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private payments: PaymentsService,
    private loyalty: LoyaltyService,
    private wa: WaService,
  ) {}

  // ---------- Pembuatan nota ----------

  /** Nomor nota harian: DJ-YYMMDD-001. Urutan aman dari tabrakan karena memakai upsert increment. */
  private async nextInvoiceNo(db: Db) {
    const ymd = wibDateStr(new Date()).replace(/-/g, '').slice(2);
    const seq = await db.sequence.upsert({
      where: { key: `inv:${ymd}` },
      create: { key: `inv:${ymd}`, value: 1 },
      update: { value: { increment: 1 } },
    });
    return `DJ-${ymd}-${String(seq.value).padStart(3, '0')}`;
  }

  /** Dipakai juga oleh klaim FREE. Harus dipanggil di dalam transaksi. */
  async createInTx(db: Db, input: NewOrderInput) {
    const customer = await db.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
    if (!customer) throw notFound('Customer');
    if (!input.items.length) throw bad('Pilih minimal satu layanan');

    const services = await db.service.findMany({ where: { id: { in: input.items.map((i) => i.serviceId) } } });
    const lines = input.items.map((it) => {
      const svc = services.find((s) => s.id === it.serviceId);
      if (!svc || !svc.isActive) throw bad('Ada layanan yang tidak tersedia, silakan pilih ulang');
      if (svc.unit === Unit.PCS && !Number.isInteger(it.qty)) throw bad(`Jumlah ${svc.name} harus bilangan bulat`);
      const { billedQty, subtotal } = calcLinePrice(svc, it.qty);
      return { svc, qty: billedQty, unitPrice: svc.rate, subtotal };
    });
    const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
    const auto = input.autoDiscount?.(lines.map((l) => ({ serviceId: l.svc.id, qty: l.qty, unitPrice: l.unitPrice, subtotal: l.subtotal })), subtotal) ?? 0;
    const discount = (input.discount ?? 0) + auto;
    if (discount > subtotal) throw bad('Diskon tidak boleh melebihi total harga');
    const total = subtotal - discount;

    const now = new Date();
    const order = await db.order.create({
      data: {
        invoiceNo: await this.nextInvoiceNo(db),
        customerId: input.customerId,
        staffId: input.staffId,
        subtotal,
        discount,
        total,
        isFree: !!input.isFree,
        countsForFree: !input.isFree && lines.some((l) => l.svc.countsForFree),
        note: input.note?.trim() || null,
        receivedAt: now,
        paymentStatus: total === 0 ? PaymentStatus.PAID : PaymentStatus.UNPAID,
        items: {
          create: lines.map((l) => ({
            serviceId: l.svc.id,
            code: l.svc.code,
            name: l.svc.name,
            unit: l.svc.unit,
            workType: l.svc.workType,
            qty: l.qty,
            unitPrice: l.unitPrice,
            subtotal: l.subtotal,
          })),
        },
      },
    });
    await this.audit.log({ userId: input.staffId, action: input.isFree ? 'ORDER_CREATE_FREE' : 'ORDER_CREATE', entity: 'Order', entityId: order.id, after: { invoiceNo: order.invoiceNo, total } }, db);
    return order;
  }

  async create(dto: CreateOrderDto, user: AuthUser) {
    const order = await this.prisma.$transaction(async (tx) => {
      const order = await this.createInTx(tx, {
        customerId: dto.customerId,
        staffId: user.id,
        items: dto.items,
        discount: dto.discount,
        note: dto.note,
      });
      // Bayar langsung saat input nota (opsional): tanpa nominal = lunas.
      if (dto.payment && order.total > 0) {
        await this.payments.addInTx(tx, order.id, { method: dto.payment.method, amount: dto.payment.amount ?? order.total }, user.id);
      }
      return order;
    });
    return this.get(order.id, user);
  }

  // ---------- Baca ----------

  async get(id: number, _user?: AuthUser) {
    const order = await this.prisma.order.findFirst({ where: { id, deletedAt: null }, include: ORDER_INCLUDE });
    if (!order) throw notFound('Nota');
    const waLogs = await this.prisma.waLog.findMany({ where: { orderId: id }, orderBy: { id: 'desc' }, take: 5 });
    const [withFree] = await this.loyalty.withFreeAvailable([orderView(order)]);
    return { ...withFree, waLogs };
  }

  async list(user: AuthUser, q: { date?: string; status?: string; payment?: string; q?: string; mine?: boolean; customerId?: number; limit?: number }) {
    const where: Prisma.OrderWhereInput = { deletedAt: null };
    if (q.date) {
      const r = periodRange('day', q.date);
      where.receivedAt = { gte: r.start, lt: r.end };
    }
    if (q.status) {
      const list = q.status.split(',').filter((s): s is OrderStatus => s in OrderStatus);
      if (list.length) where.status = { in: list };
    }
    if (q.payment === 'unpaid') {
      where.paymentStatus = { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] };
      where.status = where.status ?? { not: OrderStatus.CANCELLED };
    } else if (q.payment === 'paid') where.paymentStatus = PaymentStatus.PAID;
    if (q.mine) where.staffId = user.id;
    if (q.customerId) where.customerId = q.customerId;
    if (q.q?.trim()) {
      const s = q.q.trim();
      where.OR = [
        { invoiceNo: { contains: s, mode: 'insensitive' } },
        { customer: { name: { contains: s, mode: 'insensitive' } } },
        { customer: { phone: { contains: s.replace(/\D/g, '') || '__none__' } } },
      ];
    }
    const rows = await this.prisma.order.findMany({ where, orderBy: { id: 'desc' }, take: Math.min(q.limit ?? 100, 300), include: ORDER_INCLUDE });
    return this.loyalty.withFreeAvailable(rows.map(orderView));
  }

  // ---------- Ubah ----------

  async changeStatus(id: number, to: OrderStatus, user: AuthUser) {
    if (to === OrderStatus.CANCELLED) throw bad('Untuk membatalkan nota gunakan tombol Batalkan');
    const order = await this.prisma.order.findFirst({ where: { id, deletedAt: null } });
    if (!order) throw notFound('Nota');
    if (order.status === OrderStatus.CANCELLED) throw bad('Nota sudah dibatalkan');
    if (order.status === to) throw bad('Nota sudah berstatus itu');
    const from = FLOW.indexOf(order.status);
    const target = FLOW.indexOf(to);
    if (target < from && user.role !== Role.OWNER) throw bad('Hanya Owner yang boleh memundurkan status');

    const data: Prisma.OrderUpdateInput = { status: to };
    if (to === OrderStatus.FINISHED) data.finishedAt = new Date();
    if (to === OrderStatus.PICKED_UP) {
      data.pickedUpAt = new Date();
      if (!order.finishedAt) data.finishedAt = new Date();
    }
    if (target < FLOW.indexOf(OrderStatus.PICKED_UP)) data.pickedUpAt = null;
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data });
      await this.audit.log({ userId: user.id, action: 'ORDER_STATUS', entity: 'Order', entityId: id, before: { status: order.status }, after: { status: to } }, tx);
    });
    // Saat Selesai: WA otomatis. Kegagalan WA tidak boleh membatalkan perubahan status.
    if (to === OrderStatus.FINISHED) await this.wa.notifyFinished(id).catch(() => null);
    return this.get(id);
  }

  async update(id: number, dto: UpdateOrderDto, user: AuthUser) {
    const order = await this.prisma.order.findFirst({ where: { id, deletedAt: null } });
    if (!order) throw notFound('Nota');
    if (order.status === OrderStatus.CANCELLED) throw bad('Nota sudah dibatalkan');
    const data: Prisma.OrderUpdateInput = {};
    if (dto.note !== undefined) data.note = dto.note.trim() || null;
    if (dto.discount !== undefined) {
      if (order.isFree) throw bad('Nota FREE tidak bisa diberi diskon');
      if (dto.discount > order.subtotal) throw bad('Diskon tidak boleh melebihi total harga');
      const total = order.subtotal - dto.discount;
      if (total < order.paidAmount) throw bad(`Diskon terlalu besar, nota sudah dibayar ${rupiah(order.paidAmount)}`);
      data.discount = dto.discount;
      data.total = total;
      data.paymentStatus = paymentStatusOf(total, order.paidAmount);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data });
      await this.audit.log({ userId: user.id, action: 'ORDER_UPDATE', entity: 'Order', entityId: id, before: { note: order.note, discount: order.discount }, after: dto }, tx);
    });
    return this.get(id);
  }

  /** Batalkan nota. Staff hanya boleh bila belum ada pembayaran; Owner boleh (pembayaran otomatis di-void). */
  async cancel(id: number, user: AuthUser, reason?: string) {
    await this.closeOrder(id, user, 'cancel', reason);
    return this.get(id);
  }

  /** Hapus (soft delete) — hanya Owner. */
  async remove(id: number, user: AuthUser) {
    await this.closeOrder(id, user, 'delete');
    return { ok: true };
  }

  private async closeOrder(id: number, user: AuthUser, mode: 'cancel' | 'delete', reason?: string) {
    await this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id, deletedAt: null } });
      if (!order) throw notFound('Nota');
      if (mode === 'cancel' && order.status === OrderStatus.CANCELLED) throw bad('Nota sudah dibatalkan');
      if (order.isFree) throw bad('Nota FREE tidak bisa dibatalkan atau dihapus');
      if (order.freeClaimId) throw bad('Nota ini sudah dipakai untuk klaim FREE, tidak bisa dibatalkan atau dihapus');
      if (order.paidAmount > 0 && user.role !== Role.OWNER) throw bad('Nota sudah ada pembayaran. Minta Owner untuk membatalkan.');
      if (order.paidAmount > 0) {
        await tx.payment.updateMany({ where: { orderId: id, voidedAt: null }, data: { voidedAt: new Date() } });
      }
      await tx.order.update({
        where: { id },
        data: {
          paidAmount: 0,
          paymentStatus: PaymentStatus.UNPAID,
          ...(mode === 'cancel' ? { status: OrderStatus.CANCELLED, cancelledAt: new Date() } : { deletedAt: new Date() }),
        },
      });
      await this.audit.log(
        { userId: user.id, action: mode === 'cancel' ? 'ORDER_CANCEL' : 'ORDER_DELETE', entity: 'Order', entityId: id, before: { status: order.status, paidAmount: order.paidAmount }, after: { reason } },
        tx,
      );
    });
  }
}
