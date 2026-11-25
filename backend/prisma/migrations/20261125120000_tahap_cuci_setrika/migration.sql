ALTER TYPE "OrderStatus" RENAME VALUE 'PROCESSING' TO 'WASHING';
ALTER TYPE "OrderStatus" ADD VALUE 'IRONING' AFTER 'WASHING';

UPDATE "audit_logs"
SET "before" = jsonb_set("before", '{status}', '"WASHING"'::jsonb)
WHERE "action" = 'ORDER_STATUS' AND "before"->>'status' = 'PROCESSING';

UPDATE "audit_logs"
SET "after" = jsonb_set("after", '{status}', '"WASHING"'::jsonb)
WHERE "action" = 'ORDER_STATUS' AND "after"->>'status' = 'PROCESSING';
