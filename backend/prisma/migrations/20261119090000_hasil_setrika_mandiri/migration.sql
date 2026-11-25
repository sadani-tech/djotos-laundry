CREATE TABLE "ironing_entries" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "workDate" DATE NOT NULL,
    "customerName" TEXT NOT NULL,
    "kg" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "ironing_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ironing_entries_kg_positive" CHECK ("kg" > 0),
    CONSTRAINT "ironing_entries_customer_name_not_empty" CHECK (length(trim("customerName")) > 0)
);

CREATE INDEX "ironing_entries_staffId_workDate_idx" ON "ironing_entries"("staffId", "workDate");
CREATE INDEX "ironing_entries_workDate_idx" ON "ironing_entries"("workDate");
ALTER TABLE "ironing_entries" ADD CONSTRAINT "ironing_entries_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
