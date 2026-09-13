# Site-settings write revalidation

Date: September 13, 2026. Draft dependency: #305. Production remains ON HOLD.

## Implemented boundary

The full site-settings save, homepage navigation save and homepage structure save now share a transaction-local write boundary. They retain the initial OWNER/ADMIN check and execute the existing locked administrator authorization immediately before mutation. Current account activity, session version and membership role/status determine access, not the role captured before validation. Editor access is deliberately insufficient here.

The route pre-reads the scoped row used for image and field validation. Inside the transaction it resolves the singleton target again using the transaction client, then conditionally updates the exact ID, stored workspace (including legacy null), and pre-read timestamp. A conflicting ownership/revision/deletion produces 409 without replay. Updated timestamps advance monotonically for this writer. Full saves can create a missing scoped identity; partial saves cannot, and a unique-identity creation race returns 409 rather than overwriting the winner.

The scoped readback stays inside the transaction, so readback failure rolls back the write. Existing response fields remain available for the current settings and homepage forms. Malformed JSON/object/card/navigation/scope/booking/date values receive safe validation errors. Unexpected logs contain only a fixed category.

## Preserved behavior

- Explicit URL casing, paths, queries and fragments are unchanged.
- Booking mode, handoff, request and banner values remain configuration data, with no provider action.
- Brand/hero key ownership, canonical URL resolution and registry verification remain in place. Provider checks stay outside the database transaction.
- The nullable legacy default is not silently reassigned. Legacy mode still requires exactly one matching company; the check is repeated inside the transaction.
- Replaced images remain retained. No physical deletion, schema change, migration, OAuth/token/provider adapter, deployment or production configuration change.

## Verification

Recovered #305 at `ec83cf570e577d5c5a9bc528a4ee34f93277f869`, verified its final CI run 34732065901, and reproduced 706 passing tests plus Prisma generation and TypeScript. Main remained `72dab34568cb6885f3e93b5ed9db38edca156835`.

An executable actual-route regression failed with 200 instead of 403 before implementation. New tests exercise all three scopes with fresh revocation, suspension, editor/viewer demotion, inactive account, invalidated session, changed ownership, changed revision and deleted target. Positive tests retain exact URLs/booking flags and prove future-dated timestamps advance.

Legacy tests cover nullable identity preservation, a second company appearing before the transaction, changed target mode, scoped creation and creation conflict. Malformed inputs and initial non-administrator sessions do not write.

The isolated PGlite test executes the real route and membership lock SQL through narrow query adapters. It proves rollback after update/readback failure, all three successful scopes, a competing revision, editor demotion, revocation, and preservation of the second company's row. It is not generated Prisma, simultaneous hosted concurrency, authenticated HTTP/browser, Neon or a real provider test.

The expanded local suite passed 711/711. Final TypeScript, scoped lint, whitespace and fresh draft CI are recorded in the progress ledger and canonical claim when complete. Existing CI browser checks cover recovery/location and anonymous Next.js entry, not this authenticated settings workflow.

## Rollback and open gates

This is an application-only change, with no migration to reverse. Restoring an old writer restores the stale-authorization gap. Retain the hardened writer or suspend settings mutations while rehearsing any rollback. Do not retire the fix based solely on a successful build.

Request-time CAS does not protect an older browser tab whose revision was already stale before the request began. Submitted browser revisions, single-flight save admission, late upload/editor changes, held acknowledgement recovery and save/reopen browser QA remain next dependencies. Current forms retain drafts on ordinary API rejection, but full synthetic component/real authenticated QA is not claimed.

Registry status can still change after preflight verification; shared attachment/retirement synchronization, signed URL lifetime and media usage lifecycle remain Phase 2 gates. Legacy singleton provisioning needs a controlled tenant-mode cutover; the recheck is not a serializable platform-wide provisioning lock. Other settings writers, full-response DTO minimization, cache invalidation failure after commit, audit atomicity, hosted Prisma concurrency, overlap/restoration and protected-integration parity remain open. Phase 1/2 exits and later phases are incomplete.
