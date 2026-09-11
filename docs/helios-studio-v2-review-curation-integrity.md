# Imported review curation integrity

Curation now locks the workspace-scoped GoogleBusinessReview row before reading its current testimonial linkage. Repeated requests return the existing owned draft; a new testimonial and its review link are created in the same transaction. Existing links with missing or foreign testimonial ownership fail with a reconciliation response that does not return the foreign testimonial ID. The final update rechecks workspace and absent linkage. Only a newly created draft records the curation audit event.

This modifies local editorial curation only. Google OAuth, tokens, sync/import behavior, connections and provider requests are unchanged. Created testimonials remain unpublished.

Added `scripts/migrations/check-review-testimonial-ownership.sql` as a read-only release preflight. It raises on mismatched ownership and never infers a correction. It is not automatically executed during builds or migrations.

Actual-handler tests use a lock-serializing database mock to issue concurrent requests and verify one creation. The preflight SQL is executed in PGlite against consistent and inconsistent synthetic rows. These tests do not prove hosted lock contention, deadlock behavior or transaction authorization under concurrent membership revocation. Hosted Neon concurrency rehearsal and explicit reconciliation remain release gates.
