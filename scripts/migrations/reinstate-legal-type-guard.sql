-- ISOLATED REHEARSAL / FORWARD CONTAINMENT ONLY, not a data-loss rollback.
-- Retain the new scoped application and scoped write trigger. Do not return old
-- global readers/writers. The guard cannot be restored after duplicate types
-- exist across companies without a separate export/recovery decision.
BEGIN;
LOCK TABLE "LegalDocument" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "LegalDocument" GROUP BY type HAVING count(*) > 1)
  THEN RAISE EXCEPTION 'Cannot restore global legal guard without losing tenant data'; END IF;
END $$;
CREATE UNIQUE INDEX "LegalDocument_legacy_type_guard" ON "LegalDocument"("type");
COMMIT;
