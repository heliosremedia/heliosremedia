# Film comparison relationship integrity

Status: draft implementation, no migration or production/provider changes.

Film offerings and placements already stored workspace IDs, but placement upsert selected only global mediaId. An inconsistent existing placement could therefore be changed through another company's video. Admin reads also included unscoped placement relations, and public examples did not require the placement's own workspace to match.

Classification now requires editor permission and runs under a workspace row lock. After acquiring the lock it reloads the owned video and existing placement, checks both placement and offering ownership, and validates the requested active offering. Foreign or inconsistent records fail before clearing featured selections. Scoped update/create replaces global upsert; removal retains relationship predicates. Competing new-code featured selections serialize per company. Offering edits also require editor permission and keep workspace ownership in the final mutation predicate.

Admin reads scope placement and offering relations, and public reads require placement, offering root and media-project ownership. Identifiable foreign storage namespaces and unsafe poster URL protocols are excluded. Existing scoped custom posters can remain; new custom poster URLs need a future owned asset picker. The current classifier clears overrides, so its normal workflow remains supported. Unknown historical external posters are not certified as owned by this policy.

`scripts/migrations/check-film-comparison-ownership.sql` is an operator-only, read-only preflight for placement/media-project/offering mismatches. It never reassigns records. Apply verified reconciliation separately if it reports problems.

Executable handler/page tests verify viewer denial, foreign video/offering/placement rejection, no earlier featured mutation on failure, scoped reads/writes, preserved valid classification/removal and poster validation. PGlite verifies the mismatch preflight. These are not multi-connection Neon concurrency or browser evidence. Legacy writers do not participate in the new lock contract; drain them before tenant rollout. Ownership-changing parent operations, complete historical asset attestation, role-revocation races and broader white-label film copy/provider fallback remain open. Public layout, media/provider IDs and scheduled publishing are unchanged.
