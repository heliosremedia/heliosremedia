-- REHEARSAL / OPERATOR SCRIPT. Not part of automatic Prisma migration deploy.
-- Prepare pg_temp."ContentOwnershipMapping" on this same connection with
-- columns kind, id, workspaceId and primary key (kind,id), after verifying
-- each record's ownership. Accepted kinds: BlogPost, BlogSeries, NewsletterSeries.
-- All previously unowned records must be mapped. Never derive this mapping
-- from the creator's present account, default settings, or workspace age.
BEGIN;
LOCK TABLE "BlogPost", "BlogSeries", "NewsletterSeries" IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF to_regclass('pg_temp."ContentOwnershipMapping"') IS NULL THEN
    RAISE EXCEPTION 'Verified content ownership mapping is required';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_temp."ContentOwnershipMapping" GROUP BY kind,id HAVING count(*)>1)
  THEN RAISE EXCEPTION 'Duplicate content ownership mapping'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_temp."ContentOwnershipMapping" m
    LEFT JOIN "Workspace" w ON w.id = m."workspaceId"
    WHERE w.id IS NULL OR m.kind NOT IN ('BlogPost','BlogSeries','NewsletterSeries')
  ) THEN RAISE EXCEPTION 'Invalid content ownership mapping'; END IF;
  IF EXISTS (
    SELECT 1 FROM pg_temp."ContentOwnershipMapping" m
    LEFT JOIN (
      SELECT 'BlogPost' AS kind, id, "workspaceId" FROM "BlogPost"
      UNION ALL SELECT 'BlogSeries', id, "workspaceId" FROM "BlogSeries"
      UNION ALL SELECT 'NewsletterSeries', id, "workspaceId" FROM "NewsletterSeries"
    ) r ON r.kind=m.kind AND r.id=m.id
    WHERE r.id IS NULL OR (r."workspaceId" IS NOT NULL AND r."workspaceId" <> m."workspaceId")
  ) THEN RAISE EXCEPTION 'Mapping targets a missing record or changes existing ownership'; END IF;
END $$;
UPDATE "BlogPost" r SET "workspaceId"=m."workspaceId"
FROM pg_temp."ContentOwnershipMapping" m WHERE m.kind='BlogPost' AND m.id=r.id AND r."workspaceId" IS NULL;
UPDATE "BlogSeries" r SET "workspaceId"=m."workspaceId"
FROM pg_temp."ContentOwnershipMapping" m WHERE m.kind='BlogSeries' AND m.id=r.id AND r."workspaceId" IS NULL;
UPDATE "NewsletterSeries" r SET "workspaceId"=m."workspaceId"
FROM pg_temp."ContentOwnershipMapping" m WHERE m.kind='NewsletterSeries' AND m.id=r.id AND r."workspaceId" IS NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "BlogPost" WHERE "workspaceId" IS NULL)
    OR EXISTS (SELECT 1 FROM "BlogSeries" WHERE "workspaceId" IS NULL)
    OR EXISTS (SELECT 1 FROM "NewsletterSeries" WHERE "workspaceId" IS NULL)
  THEN RAISE EXCEPTION 'Incomplete content ownership mapping'; END IF;
  IF EXISTS (SELECT 1 FROM "BlogPost" p JOIN "BlogSeries" s ON s.id=p."seriesId" WHERE p."workspaceId"<>s."workspaceId")
  THEN RAISE EXCEPTION 'Blog post and series ownership mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM "BlogPost" p JOIN "Media" m ON m.id=p."featuredMediaId" JOIN "Project" j ON j.id=m."projectId" WHERE p."workspaceId"<>j."workspaceId")
  THEN RAISE EXCEPTION 'Blog featured media ownership mismatch'; END IF;
END $$;
COMMIT;
