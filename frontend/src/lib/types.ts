export type Role = 'OWNER' | 'STAFF';
export type OrderStatus = 'RECEIVED' | 'PROCESSING' | 'FINISHED' | 'PICKED_UP' | 'CANCELLED';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type PayMethod = 'CASH' | 'QRIS';

export interface User { id: number; username: string; name: string; role: Role; isActive?: boolean }

export interface Service {
  id: number; code: string; name: string; category: 'REGULER' | 'EXPRESS' | 'SATUAN'; unit: 'KG' | 'PCS';
  rate: number; minQty: number; minPrice: number | null; durationHours: number; countsForFree: boolean; isActive: boolean; sortOrder: number;
}

export interface FreeProgress { count: number; threshold: number; eligible: boolean }

export interface Customer {
  id: number; name: string; phone: string | null; address?: string | null; note?: string | null;
  orderCount: number; totalKg: number; totalSpent: number; unpaid: number; lastOrderAt: string | null; free: FreeProgress;
}

export interface OrderItem { id: number; serviceId: number; code: string; name: string; unit: 'KG' | 'PCS'; qty: number; unitPrice: number; subtotal: number }
export interface Payment { id: number; method: PayMethod; amount: number; paidAt: string; receivedBy: { id: number; name: string } }
export interface WaLog {
  id: number; phone: string; message: string; type: 'FINISHED' | 'FREE_READY' | 'MANUAL' | 'TEST'; status: 'QUEUED' | 'SENT' | 'FAILED';
  attempts: number; error: string | null; createdAt: string; sentAt: string | null;
  order?: { id: number; invoiceNo: string } | null; customer?: { id: number; name: string } | null;
}

export interface Order {
  id: number; invoiceNo: string; status: OrderStatus; paymentStatus: PaymentStatus; isFree: boolean;
  subtotal: number; discount: number; total: number; paidAmount: number; balance: number; kg: number; summary: string;
  note: string | null; receivedAt: string; estimatedAt: string | null; finishedAt: string | null; pickedUpAt: string | null;
  customer: { id: number; name: string; phone: string | null };
  staff: { id: number; name: string };
  items: OrderItem[]; payments: Payment[]; waLogs?: WaLog[]; freeClaimId?: number | null;
}

export interface Settings {
  shop: { name: string; address: string; phone: string; footer: string };
  free: { threshold: number; freeKg: number; notifyReady: boolean };
  wa: { autoSendFinished: boolean; finishedTemplate: string; freeReadyTemplate: string };
  staff: { dailyTargetKg: number };
}

export interface Dashboard {
  date: string; ordersToday: number; ready: number;
  unpaid: { count: number; amount: number };
  incomeToday: { cash: number; qris: number; total: number; scope: 'all' | 'mine' };
}

export interface CashSummary {
  period: string; from: string; to: string; scope: 'all' | 'mine';
  income: { cash: number; qris: number; total: number; cashPct: number; qrisPct: number; count: number };
  expense: { total: number; cash: number; qris: number; byCategory: { category: string; amount: number }[] };
  net: number; netCash: number; receivable: number;
  daily: { date: string; hari: string; cash: number; qris: number; income: number; expense: number; net: number }[];
}

export interface CashEntry {
  kind: 'IN' | 'OUT'; id: number; at: string; method: PayMethod; amount: number; title: string; subtitle: string; orderId: number | null; by: string;
}

export interface BonusLine { ruleId: number; name: string; type: 'PER_KG' | 'PERCENT_OMZET'; value: number; metric: 'KG' | 'OMZET'; current: number; minTarget: number; achieved: boolean; amount: number }
export interface BonusRow {
  userId: number; name: string; period: string; orderCount: number; totalKg: number; omzet: number; amount: number; lines: BonusLine[];
  record: { id: number; status: 'DRAFT' | 'PAID'; paidAt: string | null; amount: number } | null;
}
export interface BonusRule { id?: number; name: string; type: 'PER_KG' | 'PERCENT_OMZET'; value: number; minTarget: number; isActive: boolean }

export interface FreeRow { id: number; name: string; phone: string | null; count: number; threshold: number; eligible: boolean; claimedTimes: number; lastClaimAt: string | null }
export interface FreeOverview { threshold: number; freeKg: number; ready: FreeRow[]; progress: FreeRow[] }
