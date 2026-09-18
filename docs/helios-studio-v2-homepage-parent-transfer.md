# Homepage parent-ownership transfer races, Packet 6

## Ownership inventory before implementation

Base #312 `26bd99d98e1b86d7c65eec9b353064e3e109fd91`; main `72dab34568cb6885f3e93b5ed9db38edca156835`. Production ON HOLD.

| Record | Stored ownership | Mutation and acknowledgement boundary |
| --- | --- | --- |
| HomepageProject | Required unique Project parent, then required Project.workspaceId | POST/PATCH/DELETE and reorder use current relation predicates inside withCurationWrite; workspace/account locked, Project and child not explicitly locked before reads |
| HomepageWorkCard | Required unique Service parent, then Service.workspaceId | POST/PATCH/DELETE/reorder/presign use stored service relation in the curation transaction; submitted service is separately checked in the same workspace; parent can currently change between statements |
| Work-card library film | Nullable Media parent, then Media.projectId and Project.workspaceId | Existing quarantine plus owned visible/published selector; media/project relationships not locked across selection/attachment |
| Project hero | Nullable Project.heroMediaId, then Media.projectId/Project.workspaceId | Owned visible hero filter in DTO/public read; not a separate homepage writer |
| WorkspaceAsset preparation | Required workspace; immutable R2 namespace/key and card/kind provenance | #312 registry/URL checks inside attachment transaction; old company preparation rejected by workspace/key checks; service parent is not yet in provenance |
| SiteSettings/homepage singleton | Nullable workspace for historical default; explicit workspace singleton otherwise | #306 current actor, singleton target, owner/revision predicate and authoritative readback; separate settings/film writers, no submitted workspace accepted |
| Curation ordering | Child displayOrder; complete owned list snapshot | #311 revision hashes child ID/parent ID/order/updatedAt and workspace; membership checked before positional writes; individual reorder update counts ignored |
| Private section layout | AdminUser.homepageCurationPreferences | User/workspace updateMany predicate; zero-count write currently still returns success; no public order relationship |

Current homepage browser acknowledgements correlate workspace/scope/request/revision and card/project identity. Completed parent transfer before admission changes the owned revision or denies the scoped target. Workspace ownership is derived from stored relations, not submitted company IDs. The collection lock currently protects cooperating homepage writers, not an arbitrary Project/Service parent mutation. This distinction needs executable baseline coverage.

No supported Project/Service cross-workspace transfer endpoint was found in the reviewed writers. Work-card service reassignment within one company is supported. Cross-company races are therefore synthetic direct database changes, not an invented transfer-management feature. No transfer endpoint will be introduced.

Public readers retain current workspace/project/service predicates, visible/published filtering, curated-work precedence, featured-film fallback and legacy URL compatibility. This packet must not change presentation or public URLs. Nullable SiteSettings ownership is a separately constrained legacy singleton path; HomepageProject/WorkCard parents are required by schema. Legacy media references have no historical ownership epoch and are not silently re-homed.

## Reproduced defects and bounded changes

Before application changes, actual-route tests observed 200 instead of 409 for a reorder member whose scoped update affected zero rows and for private layout preferences after an account transfer. An actual attachment test accepted preparation carrying an obsolete service parent (200 instead of 400). A retained baseline mode (`PACKET6_BASELINE=true` for `homepage-parent-lock.test.ts`) executes #312's actual transaction wrapper and demonstrates candidate-parent ownership changing between its selection and child insertion in an explicit competing-transfer simulation. The fixed path holds the candidate lock through readback. This is not a hosted concurrency experiment.

`lockCurationParents` runs after current actor authorization and before the authoritative revision snapshot. It locks current curation parent rows, child rows, submitted candidate Project/Service, and selected/referenced library Media plus its Project, using parameterized `FOR UPDATE` queries. Current relationship predicates are then re-read by existing route code. Locks last through transaction completion, preventing a competing parent update from changing an admitted operation's ownership mid-write. No table-wide locks, transfer API, schema changes or new tenancy model were added. Reorder now rejects any zero-count member update so the shared wrapper rolls back the entire order. Private layout's scoped atomic update now rejects zero count; its broader preference-recovery redesign remains deferred.

Preparation records current stored serviceId in registry provenance and media acknowledgement. A new attachment requires both the current stored service and requested service to match that provenance. Browser preparation and attachment receipts validate serviceId. Save an intentional service reassignment before uploading new media. Already-attached exact valid media stays compatible across intentional same-company service changes; this is retention of an existing attachment, not permission to attach a pending upload from the previous parent. Older preparation without service provenance cannot be newly attached; exact existing attachments remain accepted. No automatic preparation, retry, re-homing or storage deletion is performed.

## Executable safe paths and evidence boundaries

Isolated PGlite runs the real routes, transaction wrapper, authorization and parameterized lock SQL through explicit delegates. Tests cover completed Project/Service transfer before save/reorder/delete, legacy headerless rejection, synthetic null ownership, transfer injected at admission, unchanged-owner success, and rollback. The injected admission change is inside the isolated transaction and rolls back on rejection; it does not prove independent-connection lock contention. The competing-transfer test models row-lock exclusion explicitly. A PostgreSQL/Neon multi-connection rehearsal remains required.

Existing #311/#312 tests prove wrong-workspace receipts, stale revisions, late response/unmount fencing, duplicate admission, frozen input, draft retention and no replay. Added actual-component checks cover stale parent save/reorder/remove, obsolete preparation/attachment service identity, transfer during upload, and workspace-context change while a save is in flight. Desktop/mobile Chromium extends the real curation fixture with obsolete-parent preparation/attachment and conflict-after-upload/reorder; transport is synthetic.

SiteSettings writes already revalidate singleton selection, exact owner and revision inside their transaction; scoped update acquires the target row lock and its count is checked before readback. Existing settings tests remain the executable regression evidence for owner/revision and legacy ambiguity containment. No settings/film editor changes were needed. Public readers remain unchanged. A successful receipt is a committed snapshot, not a guarantee that no later authorized change can occur after commit; stale browser writes still require the submitted revision.

## Rollback and open gates

Code-only. Retain new preparation and attachment writers together, or suspend new work-card uploads during rollback: #312 preparations lack the service binding now required for new attachment. Never erase registry records or retained objects to resolve a conflict. Exact valid legacy attachments and public URLs remain readable. Mixed-version writers do not share every lock; rehearse overlap and fail-closed browser receipt behavior before release.

Hosted authenticated browser, real storage/provider operations, independent Prisma/Neon contention, deadlock/latency behavior, historical generic legacy mapping, registry lifecycle/quarantine coordination, parent transfer-away-and-back history without an ownership epoch, and full Phase 1/2 exit gates remain open. No legitimate cross-company parent transfer workflow exists in the reviewed code; direct database transfers and future transfer tools need explicit migration policy and verification. Private organizer revision/acknowledgement recovery remains a separate packet. Production ON HOLD.

Recommended next packet: private homepage section-layout preference browser recovery inventory and executable baseline. Do not implement it here.

The existing `WorkspaceAsset_identity_guard` database trigger already rejects workspace/provider/namespace/key identity changes. The existing isolated migration test exercises that rejection; this packet does not duplicate or bypass it. Registry status/provenance lifecycle coordination remains distinct from parent ownership and is not expanded here.

Local final combined suite: **835 passed, 0 failed**. Prisma generation without migration, non-incremental TypeScript, scoped lint, curation fixture bundle and whitespace passed. Local Chromium is not claimed; fresh CI browser verification is pending publication.
