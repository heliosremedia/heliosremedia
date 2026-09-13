-- OPERATOR / ISOLATED REHEARSAL ONLY. Never automatically deployed.
-- On the same connection, prepare pg_temp."LegalOwnershipMapping" with
-- id TEXT PRIMARY KEY and "workspaceId" TEXT NOT NULL, from verified evidence.
-- Do not infer ownership from workspace age, branding or a user's current team.
BEGIN;
LOCK TABLE "LegalDocument" IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF to_regclass('pg_temp."LegalOwnershipMapping"') IS NULL THEN
    RAISE EXCEPTION 'Verified legal ownership mapping is required';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp."LegalOwnershipMapping" GROUP BY id HAVING count(*) > 1)
    OR EXISTS (
      SELECT 1 FROM pg_temp."LegalOwnershipMapping" m
      LEFT JOIN "Workspace" w ON w.id=m."workspaceId"
      LEFT JOIN "LegalDocument" d ON d.id=m.id
      WHERE w.id IS NULL OR d.id IS NULL OR (d."workspaceId" IS NOT NULL AND d."workspaceId" <> m."workspaceId")
    ) THEN RAISE EXCEPTION 'Invalid legal ownership mapping'; END IF;
  IF EXISTS (
    SELECT 1 FROM "LegalDocument" d LEFT JOIN pg_temp."LegalOwnershipMapping" m ON m.id=d.id
    WHERE d."workspaceId" IS NULL AND m.id IS NULL
  ) THEN RAISE EXCEPTION 'Incomplete legal ownership mapping'; END IF;
END $$;
UPDATE "LegalDocument" d SET "workspaceId"=m."workspaceId"
FROM pg_temp."LegalOwnershipMapping" m WHERE d.id=m.id AND d."workspaceId" IS NULL;
COMMIT;
