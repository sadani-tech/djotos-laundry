UPDATE "orders" AS o
SET "status" = 'IRONING'::"OrderStatus"
WHERE o."status" = 'WASHING'::"OrderStatus"
  AND EXISTS (
    SELECT 1 FROM "order_items" AS oi
    WHERE oi."orderId" = o."id" AND oi."workType" = 'IRON'::"WorkType"
  )
  AND NOT EXISTS (
    SELECT 1 FROM "order_items" AS oi
    WHERE oi."orderId" = o."id" AND oi."workType" IN ('WASH'::"WorkType", 'WASH_IRON'::"WorkType")
  );

WITH legacy_orders AS (
  SELECT o.id
  FROM "orders" AS o
  WHERE o."status" = 'IRONING'::"OrderStatus"
    AND EXISTS (SELECT 1 FROM "order_items" AS oi WHERE oi."orderId" = o.id AND oi."workType" = 'IRON'::"WorkType")
    AND NOT EXISTS (SELECT 1 FROM "order_items" AS oi WHERE oi."orderId" = o.id AND oi."workType" IN ('WASH'::"WorkType", 'WASH_IRON'::"WorkType"))
), latest_status AS (
  SELECT DISTINCT ON (a."entityId") a.id
  FROM audit_logs AS a
  JOIN legacy_orders AS o ON o.id = a."entityId"
  WHERE a.entity = 'Order' AND a.action = 'ORDER_STATUS' AND a."after"->>'status' = 'WASHING'
  ORDER BY a."entityId", a."createdAt" DESC, a.id DESC
)
UPDATE audit_logs AS a
SET "after" = jsonb_set(a."after", '{status}', '"IRONING"'::jsonb)
FROM latest_status AS latest
WHERE a.id = latest.id;
