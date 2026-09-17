# Homepage curation browser recovery, Packet 4

## Inventory before implementation

Baseline: #310, `b617a4312671996381115b6fba91511edecd20d7`. Main remains `72dab34568cb6885f3e93b5ed9db38edca156835`. This packet does not merge or deploy either branch.

| Surface | Request contract | Response trusted by baseline browser | Ownership / concurrency |
| --- | --- | --- | --- |
| `HomepageProjectManager` on `/admin/homepage` | POST `{projectId}`; PATCH `{placementId,titleOverride? ,active?}`; DELETE query `placementId` | `success`, `placement`; deletion ignores returned ID | Parent Project workspace, editor session; no browser revision |
| `HomepageWorkCardManager` on the same page | POST `{serviceId}`; PATCH full card editable fields; DELETE query `cardId` | `success`, `card`; deletion ignores returned ID | Parent Service workspace, foreign featured-media quarantine; no revision |
| Work-card move arrows | PATCH `{action:"reorder",cardIds:[...]}` | Ignores returned `cardIds`; optimistic local order, whole-list rollback on error | Complete list membership checked before transaction; same IDs in a stale order pass |
| Legacy project reorder API, no current control | PATCH `{action:"reorder",placementIds:[...]}` | No current component caller | Same membership-only contract |
| Work-card image/preview upload | POST `/api/admin/homepage-work-cards/presign` `{cardId,kind,fileName,fileType,fileSize}`; XHR PUT; full card PATCH | Upload key/URL/content type, followed by ordinary card response | Session workspace + card prefix; not a registry ownership receipt |
| `HomepageCurationOrganizer` | PATCH `/api/admin/homepage-layout` `{order,collapsed}` | Returned normalized preferences | Private AdminUser preference scoped by user/workspace; not public curation order, inventoried but separate follow-up |

Project title saves on blur; active toggle is a separate PATCH. Card title, destination, image description, service, media mode, library-film selection and active toggle are local drafts until Save card. Upload automatically saves the captured card. Remove and add are separate writes. Card replacement/deletion currently deletes old storage objects after the database write. General settings, structure and featured-film editors retain #309/#310 contracts and are outside this packet.

Models: `HomepageProject` has unique `projectId`; `HomepageWorkCard` has unique `serviceId`, nullable featuredMedia relation. Both have `id`, `displayOrder`, `active`, `createdAt`, `updatedAt`, but neither has direct workspace ownership. Ownership follows Project/Service. Admin cards omit `updatedAt`; projects return it on mutations but not initial component props. Limits (one project, five cards) are count checks outside write transactions. Reorder uses whole-list positional updates, not swaps. Readers sort `displayOrder`, then `createdAt`; exact legacy ties have no explicit ID tie-break. Do not silently reorder legacy public data in this packet.

Editable card DTO: `serviceId,titleOverride,destinationOverride,active,imageStorageKey,imageUrl,imageAlt,mediaMode,featuredMediaId,videoStorageKey,videoUrl`; server also returns ID/order, service summary and optional featured-media summary. Project DTO includes ID/project ID/title/order/active and project summary/hero; initial browser also receives derived image URL. No authoritative acknowledgement envelope exists at baseline.

## Public relationship and deliberately preserved behavior

`app/(public)/page.tsx` resolves the host workspace. Active published project placements require a usable owned visible hero. Cards require active owned services and valid same-workspace featured-media relationships; unpublished linked projects are filtered. Image fallback can make an otherwise imageless service card render. A successful admin write does not establish public visibility or cache propagation.

Usable configured work cards intentionally dominate the legacy featured-film slot: `configuredWorkItems.length === 0 && settings.featuredFilmEnabled`. Public presentation, portfolio links, SEO and fallback precedence remain untouched. #217 established tenant predicates; #131 introduced private admin section layout. Main #214 fixes the separate portfolio FeaturedProjectsManager drag sorting, not this curation order. No edits to that manager are authorized here.

## Executable baseline and implementation evidence

Before application changes, five actual-component checks produced four failures and one passing negative control: duplicate callbacks issued two requests; a bare success response installed foreign text; late save overwrote newer input; uncertain reorder restored stale order. Network loss did **not** automatically retry. Three actual-route checks failed: active-only project patch cleared its title; stale editor revision was ignored; a stale order with unchanged membership was accepted. A further executable removal check observed two immediate storage-deletion calls (including the nullable key). These are local synthetic reproductions, not claims about deployed exploitation.

The fixes cover `HomepageProjectManager` and `HomepageWorkCardManager`, including direct presign/transfer/save flows, not the private organizer. Both preserve current and sibling drafts in the existing ephemeral copy registry, admit one operation synchronously, freeze request payloads, validate correlated company/scope/operation/identity/order acknowledgements, fence stale handlers and unmount callbacks, and hold mutations after conflict or unknown outcomes. Inputs remain editable during pending requests; acknowledged fields merge only where the local value still matches the submitted value. Reorder preserves the attempted list after uncertainty. Prepared upload references stay in the draft. Fetch plus JSON is bounded to 20 seconds; XHR transfer has a 120-second timeout and abort handling. Explicit retained-copy acknowledgement is invalidated when any shared draft changes. Reload reads server state without replay; there is no persistent draft storage.

The smallest added server contract uses `x-curation-revision` and `x-curation-request`. Its SHA-256 snapshot includes scope/workspace and sorted row ID/parent ID/order/updatedAt. Every curation writer, including legacy requests without headers, now executes admission/count checks, write and authoritative readback under the existing workspace/account authorization lock in one transaction. Versioned stale requests receive 409. Timestamps advance beyond every visible prior row timestamp, including no-op saves and reorders. The receipt binds request ID, company, scope, previous/current revision and authoritative ordered IDs. This is an opaque content revision, not a globally ordered version number or idempotency receipt. Reorder acknowledgement uses deterministic ID tie-breaks in the administrative readback only; public legacy tie behavior is unchanged.

An active-only project patch now preserves the omitted title. Replaced/removed work-card objects are retained for uncertain-response reconciliation instead of being deleted inline. No cleanup worker or registry lifecycle was introduced. Existing key-prefix/visible-library checks and storage verification remain. Storage verification is a read-only provider check within the bounded transaction; hosted latency/timeout behavior needs rehearsal.

Executable route/helper/database tests run through a Prisma-shaped SQL adapter over isolated PGlite. They exercise stale parallel requests, committed readback, foreign IDs, revoked actors, stale reorder, rollback after partial positional failure, legacy count admission and cache failure after a committed write. This is not generated-Prisma or independent-connection Neon contention evidence. Existing two-company selector tests remain intact.

Local final combined suite: **785 passed, 0 failed**. Prisma generation without migration, non-incremental TypeScript, scoped lint, fixture bundle and whitespace passed. A final upload merge refinement was followed by all 26 component checks; exact-head CI will verify the final tree. Local Chromium installation failed on download, so no local browser pass is claimed. Fresh CI and Chromium are pending publication.

## Gates

Hosted authenticated browser, Neon contention, real object storage, provider and production parity are unverified. Parent ownership transfer, mixed-version writers, storage provenance/cleanup and private organizer recovery require explicit follow-up assessment. Production remains ON HOLD.

## Rollback and separated follow-up gates

No schema or migration change. Roll back the two editors, their page props, shared helper, and both curation routes as one unit. New editors against old servers reject missing receipts and hold for reconciliation. Old clients remain accepted by the new locked writers, but have no stale-tab precondition. Old application instances do not participate in the new lock and may still delete objects: mixed-version overlap and rollback require isolated rehearsal before release.

The separately inventoried private organizer has optimistic preference writes with no revision/readback contract. It is not public curation and is deferred. Work-card keys still inherit card identity rather than registry ownership, URL canonicalization remains legacy, parent ownership transfers require their own race review, and public exact ordering ties retain their previous behavior. No claim of complete Phase 1/2 isolation follows from this packet.

Recommended next packet: work-card upload ownership/canonical acknowledgement inventory and bounded hardening, without registry lifecycle cleanup or provider changes. Stop after Packet 4; do not implement it here.
