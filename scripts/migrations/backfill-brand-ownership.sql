-- Operator-only reconciliation after old writers have drained. Never automatic.
-- On this connection prepare pg_temp."BrandOwnershipMapping" with columns
-- kind, id, "workspaceId", primary key (kind,id), from verified record evidence.
-- Accepted kinds: Testimonial, TrustedLogo. No existing owner can be changed.
BEGIN;
LOCK TABLE "Testimonial", "TrustedLogo", "GoogleBusinessReview" IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF to_regclass('pg_temp."BrandOwnershipMapping"') IS NULL THEN
    RAISE EXCEPTION 'Verified brand ownership mapping is required';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp."BrandOwnershipMapping" GROUP BY kind,id HAVING count(*) > 1)
  THEN RAISE EXCEPTION 'Duplicate brand ownership mapping'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_temp."BrandOwnershipMapping" m
    LEFT JOIN "Workspace" w ON w.id=m."workspaceId"
    LEFT JOIN (
      SELECT 'Testimonial' AS kind, id, "workspaceId" FROM "Testimonial"
      UNION ALL SELECT 'TrustedLogo', id, "workspaceId" FROM "TrustedLogo"
    ) r ON r.kind=m.kind AND r.id=m.id
    WHERE w.id IS NULL OR r.id IS NULL OR
      (r."workspaceId" IS NOT NULL AND r."workspaceId"<>m."workspaceId")
  ) THEN RAISE EXCEPTION 'Invalid brand mapping or ownership reassignment'; END IF;
END $$;
UPDATE "Testimonial" r SET "workspaceId"=m."workspaceId"
FROM pg_temp."BrandOwnershipMapping" m
WHERE m.kind='Testimonial' AND m.id=r.id AND r."workspaceId" IS NULL;
UPDATE "TrustedLogo" r SET "workspaceId"=m."workspaceId"
FROM pg_temp."BrandOwnershipMapping" m
WHERE m.kind='TrustedLogo' AND m.id=r.id AND r."workspaceId" IS NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Testimonial" WHERE "workspaceId" IS NULL)
    OR EXISTS (SELECT 1 FROM "TrustedLogo" WHERE "workspaceId" IS NULL)
  THEN RAISE EXCEPTION 'Incomplete brand ownership mapping'; END IF;
  IF EXISTS (
    SELECT 1 FROM "GoogleBusinessReview" r JOIN "Testimonial" t ON t.id=r."testimonialId"
    WHERE r."workspaceId" IS DISTINCT FROM t."workspaceId"
  ) THEN RAISE EXCEPTION 'Review/testimonial workspace mismatch'; END IF;
END $$;
COMMIT;
