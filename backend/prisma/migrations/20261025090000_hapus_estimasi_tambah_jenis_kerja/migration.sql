-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('WASH', 'IRON', 'WASH_IRON', 'OTHER');

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "workType" "WorkType" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "orders" DROP COLUMN "estimatedAt";

-- AlterTable
ALTER TABLE "services" DROP COLUMN "durationHours",
ADD COLUMN     "workType" "WorkType" NOT NULL DEFAULT 'OTHER';


-- Isi jenis kerja layanan yang sudah ada berdasarkan kode (data lama di server tetap benar)
UPDATE "services" SET "workType" = 'WASH'      WHERE "code" IN ('CB', 'CBX');
UPDATE "services" SET "workType" = 'IRON'      WHERE "code" IN ('ST', 'STX');
UPDATE "services" SET "workType" = 'WASH_IRON' WHERE "code" IN ('CK', 'CKX');

-- Nota lama: salin jenis kerja ke item agar statistik performa bulan-bulan lalu ikut terisi
UPDATE "order_items" oi SET "workType" = s."workType" FROM "services" s WHERE s."id" = oi."serviceId";
