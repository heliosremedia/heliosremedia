-- Read-only release preflight. No correction or ownership inference is performed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "GoogleBusinessReview" r
    JOIN "Testimonial" t ON t.id = r."testimonialId"
    WHERE r."workspaceId" IS DISTINCT FROM t."workspaceId"
  ) THEN
    RAISE EXCEPTION 'Review/testimonial workspace mismatch requires verified reconciliation';
  END IF;
END $$;
