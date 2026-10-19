-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'STAFF');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'FINISHED', 'PICKED_UP', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateEnum
CREATE TYPE "PayMethod" AS ENUM ('CASH', 'QRIS');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('REGULER', 'EXPRESS', 'SATUAN');

-- CreateEnum
CREATE TYPE "Unit" AS ENUM ('KG', 'PCS');

-- CreateEnum
CREATE TYPE "BonusType" AS ENUM ('PER_KG', 'PERCENT_OMZET');

-- CreateEnum
CREATE TYPE "BonusStatus" AS ENUM ('DRAFT', 'PAID');

-- CreateEnum
CREATE TYPE "WaStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "WaType" AS ENUM ('FINISHED', 'FREE_READY', 'MANUAL', 'TEST');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "unit" "Unit" NOT NULL DEFAULT 'KG',
    "rate" INTEGER NOT NULL,
    "minQty" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "minPrice" INTEGER,
    "durationHours" INTEGER NOT NULL DEFAULT 48,
    "countsForFree" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "staffId" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "subtotal" INTEGER NOT NULL,
    "discount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "isFree" BOOLEAN NOT NULL DEFAULT false,
    "countsForFree" BOOLEAN NOT NULL DEFAULT false,
    "freeClaimId" INTEGER,
    "note" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estimatedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" "Unit" NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "method" "PayMethod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedById" INTEGER NOT NULL,
    "note" TEXT,
    "voidedAt" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "method" "PayMethod" NOT NULL DEFAULT 'CASH',
    "spentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "free_claims" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "claimedById" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "free_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_rules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BonusType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "minTarget" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_records" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "period" TEXT NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "totalKg" DOUBLE PRECISION NOT NULL,
    "omzet" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL,
    "status" "BonusStatus" NOT NULL DEFAULT 'DRAFT',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bonus_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_logs" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER,
    "customerId" INTEGER,
    "phone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "WaType" NOT NULL,
    "status" "WaStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "providerRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "wa_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "sequences" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "sequences_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "services_code_key" ON "services"("code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_invoiceNo_key" ON "orders"("invoiceNo");

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- CreateIndex
CREATE INDEX "orders_staffId_createdAt_idx" ON "orders"("staffId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "payments_paidAt_idx" ON "payments"("paidAt");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "expenses_spentAt_idx" ON "expenses"("spentAt");

-- CreateIndex
CREATE UNIQUE INDEX "free_claims_orderId_key" ON "free_claims"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "bonus_records_userId_period_key" ON "bonus_records"("userId", "period");

-- CreateIndex
CREATE INDEX "wa_logs_createdAt_idx" ON "wa_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_freeClaimId_fkey" FOREIGN KEY ("freeClaimId") REFERENCES "free_claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "free_claims" ADD CONSTRAINT "free_claims_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "free_claims" ADD CONSTRAINT "free_claims_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "free_claims" ADD CONSTRAINT "free_claims_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_records" ADD CONSTRAINT "bonus_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_logs" ADD CONSTRAINT "wa_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_logs" ADD CONSTRAINT "wa_logs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
