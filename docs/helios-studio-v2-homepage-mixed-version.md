# Homepage mixed-version compatibility and rollback, Packet 8

## Inventory before changes

Base #314 `63df1f7ba403144c9858136674b11cad8d3231f0`. Production ON HOLD. This is an isolated route/service rehearsal, not a deployed binary rollback.

| Route | Old/new request | Revision and response at #314 | Overlap concern |
| --- | --- | --- | --- |
| /api/admin/homepage-projects POST/PATCH/DELETE | projectId; placementId/titleOverride/active; query placementId; reorder placementIds | x-curation-revision/request optional; acknowledgement protocol1 scope/projects, workspace, request, previous/new revision and ids | Headerless old write bypasses stale-tab check, including deletion/reorder |
| /api/admin/homepage-work-cards POST/PATCH/DELETE | serviceId; cardId plus editable text/media/active; query cardId; reorder cardIds | Same optional curation headers, work-cards scope; attachment includes canonical media receipt | Old request can replace newer text/order/references without precondition |
| /api/admin/homepage-work-cards/presign POST | cardId/kind/fileName/fileType/fileSize; then signed PUT and separate PATCH | Same optional headers; preparation does not advance list revision; registry service/card/workspace provenance and canonical media acknowledgement | Headerless preparation can issue upload capability using stale context; raw pre-#312 writer lacks current registry protections |
| /api/admin/homepage-layout PATCH | complete order/collapsed JSON | x-layout-revision/request/workspace required; protocol1 user/workspace/scope/intent/previous/new revision and exact preferences | #314 already forces old clients to reload; raw #313 writer drops layoutGeneration and ignores new revision |

New browsers add headers, not replacement DTOs. Current curation retains media objects. New storage namespace and registry/provenance are already present before this packet. Private layoutGeneration is additive JSON, ignored by the existing normalizer. No new required column or downgrade transformation is needed. Settings/featured-film use separate SiteSettings revisions and do not write these collections or preference JSON; their existing regression suites remain required, but those writers are not changed here.

Historical old server and rollback-compatible server are different categories. An immutable old server cannot acquire new authorization/revision guards from browser code. Supported rollback must retain the reviewed mutation bundle while rolling back readers/UI. Unpatched historical writer deployment is rejected by the bounded artifact preflight; it is not certified safe merely because a new browser holds its acknowledgement. In particular an unvalidated receipt can follow an already-committed unsafe write.

## Planned executable matrix

Old browser / old-compatible server and old browser / new server: explicit reload conflict for requests without required revision; no mutation or preparation. Revision-aware #311-#314 browsers retain wire compatibility with the new curation guard. New browser / new server and new browser / compatible rollback server: same authority, revision and canonical attachment contract. A browser loaded before either transition may write only if its revision remains current; otherwise409 with its existing recovery copy. Raw historical server combinations are negative controls, not supported rollout targets. No arbitrary historical version may receive these mutations during the overlap window.

## Executed matrix and compatibility boundary

| Browser / server combination | Executable result | Supported interpretation |
| --- | --- | --- |
| Headerless pre-recovery browser / retained compatible writer | 409 HOMEPAGE_RELOAD_REQUIRED before SQL or upload signing for project/card mutations; layout already returns409 | Retain text manually and reload into current editor. Historical UI may only display its existing error, not the newer recovery panel. No false success |
| Headerless browser / new writer | Same rejection for create, edit, remove, reorder and preparation | Deliberate bounded reload gate, not a global old-writer retirement |
| Revision-aware #311–#314 DTO / new writer | Current revision accepted; original placement/card/upload fields retained, additive acknowledgement retained | Existing request DTOs remain compatible. This is wire compatibility evidence, not execution of every historical browser. Older upload clients without canonical receipt validation are not certified for new upload flows |
| Current browser / current writer | Correlated revision and canonical receipt, current authority and stored parent relationships | Supported |
| Current browser / compatible rollback artifact | Same retained mutation bundle and wire contract; historical readers can ignore additive fields | Supported only with independently verified deployment routing/configuration; this packet does not deploy an artifact |
| Browser loaded before deployment or rollback | Current revision accepted, obsolete revision409; missing one header409, not downgrade to unversioned | Conflict/reload recovery and retained draft; no automatic replay |
| Current browser / raw #314 curation writer | New headers remain understood, but raw old writer still admits unversioned rivals | UNSUPPORTED rollback target; negative control proves stale overwrite followed by409 for new browser's now-obsolete revision |
| Current browser / raw #313 layout writer | Writes may commit while dropping layoutGeneration; browser rejects missing acknowledgement and holds attempted choice | UNSUPPORTED rollback target. Browser containment cannot undo a committed write |
| Old reader / new curation, registry and layout state | Historical #313 layout normalizer reads order/collapse; #312 media resolver reads exact registered attachment; ordered SQL rows remain readable | Additive acknowledgement is transport-only; layoutGeneration ignored during read without rewriting stored JSON |

The current rollback preflight is **read-only and advisory**, not a deployed routing guard. Run `node scripts/rehearsal/check-homepage-rollback.mjs /path/to/candidate` on an isolated candidate tree. It compares the listed authorization, parent-lock, revision, canonical-media and mutation files against SHA256 entries in `scripts/rehearsal/homepage-writer-bundle.json`. Historical helper substitution or historical layout route substitution fails. Restoring the reviewed bundle passes. This narrow file check does not attest all transitive dependencies, credentials, database state, caches, binary artifacts or request routing. A full historical Vercel deployment promotion is not made safe by this script. Before any rollout, prove that all in-scope mutations reach the retained hardened bundle and no historical instances can service them; otherwise stop the rollout/rollback. Production remains ON HOLD.

## Baseline and smallest fix

Before changing the application helper, actual route/PGlite tests failed because a headerless project edit overwrote a confirmed new edit, a headerless work-card reorder replaced confirmed order, and an old upload request signed and registered a new preparation. Each expected409 and received200. Historical checksum-pinned #314 helper remains an executable negative control rather than pretending the old binary was fixed. Historical #313 layout route demonstrates erasure of additive layoutGeneration.

The only application-code change requires both existing x-curation-revision and x-curation-request at `withCurationWrite`, shared by three curation/preparation routes. Missing/partial headers return409 with an explicit reload-required code. Oversized values still fail400. Existing lock, authorization, ownership, revision calculation, complete ordering membership, canonical media and authoritative readback behavior is unchanged. Private layout already required its three headers, so its server and browser are unchanged. No general SiteSettings/featured-film writer changes.

Actual component tests additionally exercise current curation against raw older-server acknowledgements and the explicit reload code, and private layout after a confirmed save followed by an older-server bare success. Draft/choice remains held and repeated callbacks do not replay writes. Chromium fixture modes now simulate an older server omitting the acknowledgement for the actual project/card editors and private organizer at390/1440px. Existing timeouts, newer edits, sibling drafts, late callback/remount, prepared reference, copy-before-reload and no-replay checks remain required.

## Rehearsal A–H

`lib/homepage-mixed-version.test.ts` executes the actual routes/helpers through `scripts/rehearsal/homepage-database-fixture.ts`, an explicit Prisma-shaped adapter over isolated PGlite:

1. A: seed two workspaces, owned services/projects/cards, legacy null private preference JSON.
2. B/C: apply current writer; reorder complete card list, register/sign synthetic upload, canonically attach, save private layout with generation.
3. D/E: load historical read functions and fresh retained current mutation modules over the same database. Verify order, exact key/URL/registry id and private choice remain readable. Reads do not remove additive generation.
4. F: reject headerless or stale mutations, reject old preparation/attachment requests and foreign/unregistered/mismatched media; private JSON remains byte-equivalent under rejected old writes.
5. G/H: reload current modules, save again with returned current revisions, verify advancement and rejection of previous revisions. Exactly one prepared registry row and zero object deletions remain.

Separate negative controls deliberately execute raw historical writers on disposable data to prove why they are prohibited rollback targets. Their tests expect the unsafe historical behavior. They must not be read as support for deploying those writers.

This is **not** a full application-binary rollback. No real storage upload, real provider HEAD, production data, hosted authentication, generated Prisma execution, independent PostgreSQL/Neon connection contention or deployment routing is exercised. PGlite serializes this adapter's transactions; existing parent transfer and membership tests remain independent evidence. Synthetic provider checks prove call admission and retained identity, not object existence. Historical files are fixed source snapshots with original commit/path/checksum manifest; no runtime dependency or executable downgrade utility is introduced.

## Data, fallback and rollback safety

No schema/migration/required column is introduced. Application-only rollback using retained reviewed writers is sufficient for the rehearsed data; no restoration or downgrade transformation is needed. Do not rewrite JSON through raw old writers. If an unsupported historical writer has already changed data, reconciliation/restoration needs a separate incident decision; this rehearsal does not certify recovery of overwritten production data.

Legacy exact attached media remains readable. Replaced/removed objects are retained; no cleanup is added. New preparations remain workspace/card/service scoped and require current attachment admission. No automatic preparation/write retry occurs. Public reads, URLs, SEO, deterministic order, layout defaults, curated-work dominance and featured-film fallback are unchanged. Private organizer success is not public rendering evidence.

## Verification and remaining gates

Local full regression:881 passed, zero failed. Targeted rehearsal:8 tests; actual curation/private layout components:74 tests. Prisma generation without migration, non-incremental TypeScript, scoped lint, both fixture bundles, candidate preflight and whitespace passed. Local Chromium executable is unavailable. Fresh CI/Chromium is pending. Local fixture bundling is not Chromium verification.

Remaining Phase1/2 gates: hosted authenticated flows; real generated-Prisma/Neon independent contention; provider media verification; full binary/routing mixed-version rehearsal with a compatible candidate; backup restoration and operational release review; remaining tenant isolation inventory and shared media/job reliability gates. Production ON HOLD. No merge, deployment, migration, provider changes, cleanup or next packet.

Recommended next packet only: a bounded isolated full application candidate rollback/routing rehearsal with generated Prisma/PostgreSQL and synthetic credentials, preserving this mutation bundle. Define its environment/access first; do not use it to retire writers or expand registry lifecycle.
