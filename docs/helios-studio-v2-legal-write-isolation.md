# Legal document identity and write isolation

September 13, 2026. Draft stacked on #306. Production remains ON HOLD.

## Application boundary

Legal editing now uses a callback transaction with the existing locked administrator authorization. Initial editor/viewer sessions are refused locally; current database membership, account activity and session version are revalidated immediately before writes. The transaction re-resolves both document scope and settings identity through the transaction client.

No global type upsert remains in application code. Reads select type plus authoritative company scope. Existing writes require the exact ID, type, stored ownership and revision checked before validation. Document content and its company's footer publication flag commit or roll back together. Both timestamps advance monotonically for this writer. Creation conflicts return 409 without overwriting the existing company or retrying the request.

If its settings row is missing, the transaction reconstructs both legal publication flags from that company's published documents, so saving one draft does not hide the other published document. Failed settings creation rolls back document creation too.

The current legal editor already submits `updatedAt`. When present, the route validates canonical ISO syntax and compares it with the stored revision; epoch zero represents an unsaved default. An already-stale editor receives 409. Older callers that omit the field retain request-time CAS only and remain a retirement gate. No arbitrary request workspace, hostname, header or document ID establishes ownership.

Public and Studio document responses select only ID, type, title, sanitized content, publication state and revision. Existing sanitization and legal text are preserved. Unexpected logs use a fixed category. This work does not draft, approve or choose legal commitments.

## Staged database compatibility

The automatic expansion migration `20260913033000_legal_scoped_identity_expand` adds company/type uniqueness and renames the existing global type index to `LegalDocument_legacy_type_guard`. The renamed index still enforces global uniqueness and supports old `ON CONFLICT(type)` writes. The Prisma schema stops exposing a global type selector; the database-only legacy guard is intentional. Do not run `prisma db push`, accept generated drift cleanup, or remove that index automatically.

Expansion alone does not enable a second company's conflicting document type. The new application works before and after expansion with scoped reads, ID-based updates and safe conflict handling. No historical row ownership, text, publication flag or timestamp is changed by expansion.

The following scripts are outside automatic migrations and were executed only against isolated PGlite fixtures:

1. `scripts/migrations/backfill-legal-ownership.sql` requires a verified same-connection temporary mapping for every unowned document. Missing, incomplete, duplicate, foreign/missing-company and ownership-changing mappings fail before updates. Only ownership changes; text and publication history remain intact.
2. `scripts/migrations/contract-legal-ownership.sql` requires a single reviewed-head attestation plus verified retirement of old readers/writers, backup and tenant-context evidence. It locks legal/settings tables, rejects unmapped rows and mismatched publication flags, requires expansion indexes, installs a scoped write guard, makes ownership required and removes the global guard atomically.
3. `scripts/migrations/reinstate-legal-type-guard.sql` restores the global uniqueness guard only if no duplicate types exist. It never deletes a second company's documents, removes the scoped trigger, or makes returning to old application code safe.

The cutover attestations are not proof by themselves. They require independently reviewable evidence and Jake's release decision before any production use. No production mapping, backup or cutover is claimed.

After contract, the new route sets a transaction-local company marker only after locked authorization. The database trigger rejects unmarked/mismatched writes and changes to document ID, type or owner. The marker does not authenticate a SQL caller, protect old readers, or replace application authorization. All old global readers must be retired before duplicate types are enabled. Keep tenant context enabled and new scoped servers throughout rollback.

## Evidence and limitations

An executable actual-route regression returned 200 instead of 403 for revoked access before implementation. Isolated tests execute the actual route, membership lock SQL, singleton/content scope, sanitization, public/Studio readers and all three operator scripts through narrow PGlite adapters.

Coverage includes old-writer expansion compatibility; fail-closed mapping/attestations; publication-flag reconciliation; preservation of original text/state; two companies sharing a document type after contract; same-company uniqueness; foreign-marker and identity-transfer denial; unmarked update/delete denial; marker reset between transactions; stale browser/request revisions; fresh revocation/demotion/session invalidation; and rollback on document readback/settings failure. The second company's document and flags stay isolated. Expansion reversal/reapplication and safe refusal to restore global uniqueness after duplicate types are also rehearsed.

The adapter explicitly parses PostgreSQL timestamp-without-zone as UTC, matching the installed Prisma Neon normalization. Its initial local failure exposed the runner's +08 timezone interpretation, not a production timestamp change. No production adapter was modified. These tests do not prove generated Prisma, hosted Neon concurrency, real authenticated HTTP/browser, public SEO parity, or backup restoration. CI's existing Chromium/anonymous Next.js checks remain separate evidence, not legal-editor browser QA.

## Release and rollback gates

Local final verification: 717 tests, Prisma generation, route generation/non-incremental TypeScript, scoped ESLint and whitespace passed. Draft CI evidence is recorded in the progress ledger and canonical claim after publication.

- Rehearse the exact generated Prisma/Neon client and UTC timestamp behavior, old/new server overlap, all public/admin/sitemap readers and tenant-mode cutover on a hosted isolated database.
- Verify historical mapping and publication flags without authoring or overwriting approved legal copy. Preserve a restorable backup with counts and content/state hashes.
- Before contract, expansion reversal may drop the new composite index and restore the old index name without losing rows. Keep application write authorization hardened.
- After contract, retain the scoped application and trigger. Once duplicate types exist, do not attempt a destructive global-uniqueness rollback; use forward containment and an independently reviewed export/recovery plan.
- No `db push` or automatic schema-drift cleanup. The legacy guard and post-contract trigger/non-null boundary are operator-managed compatibility controls.
- UI acknowledgement recovery, duplicate-save admission, input freezing, unsaved-copy comparison and authenticated browser save/reopen remain next dependencies. Request-time CAS is not enough for clients omitting revisions.
- Audit atomicity, cache invalidation failure after commit, complete platform/support isolation, other global slugs, settings/media lifecycle and Phase 1/2 exits remain open. Protected Google review-display changes remain separately scoped; OAuth/tokens/provider adapters were not touched.
