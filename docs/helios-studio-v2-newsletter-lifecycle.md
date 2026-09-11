# Newsletter lifecycle authorization

Draft implementation, dependent on communication-group ownership. Production remains on hold for implementation readiness and QA with Jake.

Pause/resume now scope the series inside the transaction before job changes. Manual full generation resolves the actor's current authorized workspace and verifies edition ownership before claiming work. Cron generation continues to use stored series ownership. Block AI requires an actor, scopes the block through its series, resolves stored ownership and reads company settings explicitly.

New generated source snapshots and generation manifests carry workspace identity. Block rewrites reject foreign snapshot ownership before calling AI. Unstamped historical sources remain compatible only in a verified single-company installation; multi-company legacy sources must be regenerated or explicitly reconciled.

Block content updates now occur in the same transaction as revisions, approval revocation and edition changes. A row-version predicate rejects edits that became stale during AI generation. Save and approval transactions similarly check the reviewed row version before mutation. Full generation completion checks its claimed version, generating state and active series before replacing content; error handling cannot overwrite an edition whose version/state changed meanwhile. Regeneration revokes existing approval records.

Executable tests use real transpiled handlers/functions with mocked dependencies: foreign lifecycle targets, actor/edition mismatch, foreign source snapshots, stale block rewrites and stale approvals fail before their respective downstream mutations/provider calls. These do not replace real concurrent Neon tests, authenticated HTTP/browser QA or delivery verification. Remaining cancellation/reschedule/send concurrency and membership revocation races require broader review. Existing temporary single-company guards remain. No real AI generation, scheduled job, email or provider credential was used.
