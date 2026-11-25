CREATE TABLE "order_ironing_entries" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "staffId" INTEGER NOT NULL,
    "kg" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_ironing_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_ironing_entries_kg_positive" CHECK ("kg" > 0)
);

CREATE INDEX "order_ironing_entries_orderId_idx" ON "order_ironing_entries"("orderId");
CREATE INDEX "order_ironing_entries_staffId_createdAt_idx" ON "order_ironing_entries"("staffId", "createdAt");
CREATE INDEX "order_ironing_entries_createdAt_idx" ON "order_ironing_entries"("createdAt");
ALTER TABLE "order_ironing_entries" ADD CONSTRAINT "order_ironing_entries_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_ironing_entries" ADD CONSTRAINT "order_ironing_entries_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Pertahankan hasil historis yang sebelumnya dihitung dari audit penyelesaian nota.
WITH completed AS (
  SELECT DISTINCT ON (a."entityId") a."entityId" AS "orderId", a."userId" AS "staffId", a."createdAt"
  FROM audit_logs a
  WHERE a.entity = 'Order' AND a.action = 'ORDER_STATUS'
    AND a."before"->>'status' = 'IRONING' AND a."after"->>'status' = 'FINISHED'
  ORDER BY a."entityId", a."createdAt" DESC, a.id DESC
), weights AS (
  SELECT "orderId", ROUND(SUM(qty)::numeric, 2) AS kg
  FROM order_items WHERE unit = 'KG' AND "workType" IN ('IRON', 'WASH_IRON')
  GROUP BY "orderId"
)
INSERT INTO "order_ironing_entries" ("orderId", "staffId", "kg", "createdAt")
SELECT o.id, c."staffId", w.kg, c."createdAt"
FROM completed c JOIN orders o ON o.id = c."orderId"
JOIN weights w ON w."orderId" = o.id
JOIN users u ON u.id = c."staffId"
WHERE o."deletedAt" IS NULL AND o.status IN ('FINISHED', 'PICKED_UP') AND w.kg > 0;
