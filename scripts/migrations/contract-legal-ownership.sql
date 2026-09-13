-- OPERATOR / ISOLATED REHEARSAL ONLY. Not an automatic Prisma migration.
-- Production is held for verified readiness and Jake's QA/release decision.
-- Supply exactly one pg_temp."LegalCutoverApproval" row with reviewedHead TEXT,
-- retiredLegacyReaders, retiredLegacyWriters, backupVerified, tenantContextVerified BOOLEAN.
-- These attestations require external evidence; setting them is not verification.
-- A new transaction-local write marker fences old writers, NOT old readers.
BEGIN;
LOCK TABLE "LegalDocument", "SiteSettings" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF to_regclass('pg_temp."LegalCutoverApproval"') IS NULL THEN
    RAISE EXCEPTION 'Verified legal cutover approval is required';
  END IF;
  IF (SELECT count(*) FROM pg_temp."LegalCutoverApproval") <> 1 OR EXISTS (
    SELECT 1 FROM pg_temp."LegalCutoverApproval"
    WHERE "reviewedHead" IS NULL OR "reviewedHead" !~ '^[a-f0-9]{40}$'
      OR "retiredLegacyReaders" IS DISTINCT FROM true OR "retiredLegacyWriters" IS DISTINCT FROM true
      OR "backupVerified" IS DISTINCT FROM true OR "tenantContextVerified" IS DISTINCT FROM true
  ) THEN RAISE EXCEPTION 'Legal cutover evidence is incomplete'; END IF;
  IF EXISTS (SELECT 1 FROM "LegalDocument" d LEFT JOIN "Workspace" w ON w.id=d."workspaceId" WHERE w.id IS NULL)
  THEN RAISE EXCEPTION 'Legal ownership must be verified before cutover'; END IF;
  IF EXISTS (
    SELECT 1 FROM "LegalDocument" d LEFT JOIN "SiteSettings" s ON s."workspaceId"=d."workspaceId"
    WHERE s.id IS NULL OR (CASE WHEN d.type='PRIVACY_POLICY' THEN s."privacyPolicyPublished" ELSE s."termsOfServicePublished" END) IS DISTINCT FROM d.published
  ) THEN RAISE EXCEPTION 'Legal publication flags must reconcile before cutover'; END IF;
  IF to_regclass('"LegalDocument_legacy_type_guard"') IS NULL
    OR to_regclass('"LegalDocument_workspaceId_type_key"') IS NULL
  THEN RAISE EXCEPTION 'Legal expansion indexes are required'; END IF;
END $$;

CREATE FUNCTION helios_guard_legal_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN owner_id := OLD."workspaceId";
  ELSE owner_id := NEW."workspaceId"; END IF;
  IF owner_id IS NULL OR current_setting('helios.legal_workspace', true) IS DISTINCT FROM owner_id THEN
    RAISE EXCEPTION 'Scoped legal writer is required' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' AND (OLD."workspaceId" IS DISTINCT FROM NEW."workspaceId"
    OR OLD.id IS DISTINCT FROM NEW.id OR OLD.type IS DISTINCT FROM NEW.type) THEN
    RAISE EXCEPTION 'Legal identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "LegalDocument_scoped_write_guard" BEFORE INSERT OR UPDATE OR DELETE ON "LegalDocument"
FOR EACH ROW EXECUTE FUNCTION helios_guard_legal_write();
ALTER TABLE "LegalDocument" ALTER COLUMN "workspaceId" SET NOT NULL;
DROP INDEX "LegalDocument_legacy_type_guard";
COMMIT;
