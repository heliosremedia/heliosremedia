-- Read-only relational preflight. A mismatch must be reconciled from verified
-- evidence; never transfer a placement automatically to satisfy this check.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "VideoComparisonPlacement" c
    JOIN "Media" m ON m.id=c."mediaId"
    JOIN "Project" p ON p.id=m."projectId"
    JOIN "VideoOffering" o ON o.id=c."offeringId"
    WHERE c."workspaceId" IS DISTINCT FROM p."workspaceId"
       OR c."workspaceId" IS DISTINCT FROM o."workspaceId"
  ) THEN RAISE EXCEPTION 'Film comparison workspace mismatch'; END IF;
END $$;
