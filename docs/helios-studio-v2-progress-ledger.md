# Helios Studio V2 progress ledger

## Latest checkpoint: September 12, 2026

- Latest implementation: draft [#293](https://github.com/heliosremedia/heliosremedia/pull/293), branch `codex/v2-newsletter-recurrence-serialization`, remote code head `6a68fa585fafcd481de2c90437a4092d2d54e55b`, tree `34165d56554caaa3a2912047fe52278e9b386fb9`. Local `a92959aaa36691df1327648927248d43586005d9` has the identical tree. This ledger checkpoint is a documentation-only follow-up; the canonical claim records the final published branch head.
- Verification: all 639 tests passed locally and in [GitHub run 34707861194](https://github.com/heliosremedia/heliosremedia/actions/runs/34707861194). Fresh-runner Prisma generation, non-incremental TypeScript, real Chromium synthetic recovery/job-view interactions and whitespace all passed. No authenticated hosted HTTP, Neon concurrency or deployed workflow parity is implied.
- This work block published #291 job visibility/unsupported-work containment, #292 analytics isolation and #293 recurrence serialization. All are drafts with verified implementation CI. Main remains `72dab34568cb6885f3e93b5ed9db38edca156835`; no production merge or deployment occurred.
- Phase 1 isolation exit remains open while Phase 2 reliability work advances. Next dependency: review bounded generation execution/lease semantics and shared-job convergence, retaining current version/token fencing and explicit recovery. Do not add an unbounded heartbeat that can revive stale execution or imply invocation survival. Broader ownership audit, hosted concurrency/restoration and full-stack negative tests remain necessary before later product/commercial phases or Jake's QA gate.
- Coordination: read `docs/helios-studio-v2-run-claim.json` from `ops/v2-automation-control`, then acquire with an expected current blob SHA before edits. Never create a competing per-feature claim. Follow that record's current branch/expiry and inspect this ledger for newer entries. Scratch is disposable; GitHub is the durable checkpoint.

## 2026-09-11 checkpoint recovery and migration preflight

Stage: Phase 1, not production-ready. Phase 0 inventory remains incomplete.

### Verified evidence

- Recovered clean checkout at local commit 8646a68. Local tree 818859e71ef68eceb926c42b64e3eb20d30716f8 matches the published #218 checkpoint tree.
- GitHub confirms #208, #209, #211, #213, #215, #216, #217 and #218 remain open drafts. No merges performed.
- Main at 72dab34568cb6885f3e93b5ed9db38edca156835 is three commits ahead of the stack merge base. V2 has ten commits on its side. Main reconciliation remains required; preserve production hotfixes.
- Vercel get_project for heliosremedia in the supplied team returned 404 Not Found. Project/deployment inspection and hosted verification remain unavailable through that connection.
- Reproduced npm test: 386 passed, zero failed. Non-incremental TypeScript passed.
- Read repository instructions, V2 documents, installed Next.js data-security guidance, and production build migration mechanism.

### Implementation in this slice

Removed oldest-workspace/default-settings inference from the brand-asset migration. Require a valid explicit connection-scoped legacy mapping when manual records need ownership. Imported review ownership still comes from its review. Extended executable PGlite coverage: absent mapping, invalid mapping, rollback preservation, valid mapping and separate imported-review ownership. Both focused tests pass. This is isolated SQL evidence, not hosted Neon or authenticated API evidence.

### Release blockers and next work

1. Review and reconcile main changes and PR dependency conflicts without overwriting hotfixes.
2. Establish controlled migration gates instead of automatic production-build application; verify migration history before modifying draft checksums.
3. Rehearse old/new application overlap and rollback; required ownership columns currently break legacy creates.
4. Close storage-key attachment, overwrite and cleanup ownership gaps; preserve legacy asset access.
5. Validate same-workspace Google review curation with concurrency evidence while preserving OAuth/token code.
6. Review homepage hero and all relational media references.
7. Complete model/route/job/cache/integration inventory and executable tenant-negative coverage.
8. Continue Blog and Newsletter explicit ownership, source isolation and authorization.
9. Hosted preview, migration/restore rehearsal and production release remain blocked and unverified. No tenant flag, production migration, campaign, social publication or protected integration was changed.

Roadmap phases 2 through 7 remain as described in helios-studio-v2-roadmap.md. Commercial pricing, live billing and customer onboarding still require business decisions.

## 2026-09-11 brand storage isolation

- New testimonial and trusted-logo uploads use strict workspace namespaces generated from the server session. Invalid workspace IDs are rejected, never normalized into another ID.
- Mutations reject foreign namespaces, traversal and new legacy-key attachments. Managed image URLs derive from validated keys, not client URLs. Existing legacy images can remain unchanged on their authorized record.
- Replacement/deletion retains underlying objects and reports cleanup pending. No worker is claimed or scheduled: asset usage tracking and durable garbage collection are follow-up work. This avoids deleting shared or misattributed legacy assets and attachment/deletion races.
- Actual POST handlers are executed with mocked session, Prisma and storage dependencies. Tests verify editor authorization, rejection before storage access and server URL derivation. Policy tests cover legacy retention, forged paths and workspace collisions. Hosted HTTP/browser and live storage verification remain outstanding.
- Fetched current main: its three commits are gallery spacing and featured drag ordering hotfixes. These must be retained in reconciliation.

Reconciliation completed locally: merged main 72dab34568cb6885f3e93b5ed9db38edca156835 without conflicts, retaining all five hotfix files. Combined suite: 393 passed, zero failed. Non-incremental TypeScript and focused ESLint passed. Actual DELETE handler tests also verify a corrupted foreign storage association does not issue a storage deletion (focused rerun passed). No production merge/deployment performed. This branch does not resolve the older stack's individual dependency conflicts or establish rollout readiness.

## 2026-09-11 Blog access containment and release instruction

Jake clarified the release sequence: complete implementation, report readiness, conduct QA together, then consider production deployment. Do not use earlier broad production authority to skip that sequence. Development and draft publication remain authorized.

Recovered published #220 into /workspace/scratch/dd93a0742694/heliosremedia-v2 at bf1c2a080604a463d97cb6ae3fe396c494f3d03b. The older checkout had returned to #218 and contains an unrelated standard-13.jpg edit; left intact. Use this new worktree for subsequent implementation.

Added a common local editor/session guard to every Blog admin route: posts, revisions, presign, AI, generated images, series management/generation/assistant, and email-draft conversion. Until Blog ownership is explicit, access requires exactly one workspace matching the authenticated session. Empty, foreign and multiple-workspace databases fail closed. Existing stricter route checks remain. This is temporary containment, not multi-company Blog support. Provisioning a second workspace still requires the full isolation gate; a workspace-count check is not a concurrency-safe tenant ownership model.

Executable guard tests cover anonymous/read-only sessions and empty, foreign, ambiguous and valid workspaces. A separate source contract verifies every Blog admin handler enters the guard before its own work. These do not establish authenticated hosted HTTP or browser verification.

Remaining Blog ownership conversion inventory: app/blog/page.tsx, app/blog/[slug]/page.tsx, app/sitemap.ts, app/admin/blog/page.tsx, lib/blog-series.ts, cron/blog-series, lib/social/studio.ts, app/admin/social-studio/page.tsx, lib/newsletters/generation.ts, lib/newsletters/content-sources.ts, newsletter edition/image routes, and the guarded Blog routes. Public reads, cron and cross-module source reads remain global. No second company may be activated until they are converted. No schedules or provider connections changed in this slice.

Combined verification on recovered #220 plus Blog changes: 395 tests passed, zero failed; non-incremental TypeScript passed; focused Blog ESLint passed. No production build, migration, deployment, recipient message or publication was run.

## 2026-09-11 Blog ownership expansion

Implemented nullable ownership fields with restrictive foreign keys and ownership indexes, preserving legacy inserts and global slug uniqueness. New manual post/series writes store session workspace. Generated drafts store series context; legacy generation requires a sole workspace and scopes source/settings reads. Blog public index/detail/sitemap use workspace ownership behind tenant mode; draft preview requires matching session/public/stored workspace. Existing Blog admin containment remains until all consumers and backfill are complete.

Migration tests exercise actual SQL with two companies: unchanged historical content, nullable old-app inserts, owned new inserts, invalid references, restricted workspace deletion and retained slug uniqueness. Added executable preview policy tests. See helios-studio-v2-blog-ownership.md for remaining conversion and deployment gates. No production data or scheduled execution changed.

Verification: Prisma 7.8 generation passed with a loopback placeholder configuration (no database connection); full suite 397 passed, zero failed; non-incremental TypeScript and focused lint passed; diff check passed. This is development evidence, not hosted QA or release readiness.

## 2026-09-11 Blog and Newsletter ownership paths

Continued beyond the previous draft: scoped Blog admin mutations/revisions/list/media/settings/series selection; scoped Blog and Newsletter sources consumed by Social Studio without changing provider or publication code; quarantined foreign featured-media references. Expanded NewsletterSeries with nullable stored workspace ownership and recorded ownership on new series. Background generation and source selection use stored series context, not the creator's current account or request headers. Scoped Newsletter edition access and Blog/project gallery selections. Added temporary single-company Newsletter API containment while downstream workflows remain unfinished.

Prepared a separate explicit per-record backfill script and isolated SQL rehearsal for BlogPost, BlogSeries and NewsletterSeries. It fails and rolls back incomplete mappings and relational mismatches, rejects ownership reassignment and is idempotent for a verified mapping. It is not in automatic deployment migrations and has not run on hosted or production data.

See helios-studio-v2-content-ownership-paths.md for exact behavior, compatibility limits and remaining work. Next dependencies: Blog upload/image-generation ownership; Newsletter AI assets and immutable source snapshots; recipient/group and delivery ownership; complete model/route/job inventory; controlled migration gates and hosted QA access. Keep both marketing modules single-company and keep production release on hold for Jake's QA sequence.

Verification for this combined milestone: 403 tests passed, zero failed; regenerated Prisma client; non-incremental TypeScript passed after correcting a test result type; focused lint and diff checks passed. Reviewed changed server-rendered pages using the React checklist and stripped extra featured-media ownership metadata from editor props. No hosted browser/HTTP test, production build, migration, external AI generation, message, campaign or publication was executed.

## 2026-09-11 production build migration gate

Continued after publishing #223. Replaced production-build `prisma migrate deploy` with a migration-history status check that must pass before Prisma generation and Next.js build. No build-time database migration is invoked by the changed script. Actual-script tests with mocked child processes cover successful production checks, nonzero/missing process status and preview/local behavior. Installed Prisma 7.8 code confirms unapplied migration history returns nonzero. This does not prove schema drift, data integrity or hosted QA.

Added controlled-migrations runbook for pinned artifacts, full pending-migration review, verified backfill, backup restoration, old/new overlap and schema-compatible rollback. The safeguard exists only on the draft branch; main/production are unchanged. No production build or database command was executed. Production still waits for implementation readiness and QA with Jake.

Verification: full combined suite 406 passed, zero failed; non-incremental TypeScript, focused build-script lint and diff checks passed. These tests did not launch a real production build or connect to production.

## 2026-09-11 editorial image ownership

Added nullable NewsletterImageAsset workspace ownership and scoped AI gallery/save queries. The shared image generator verifies actor access before provider use and persists workspace identity. Blog presigns and shared AI images use workspace namespaces; Blog attachments validate ownership and derive URLs server-side while preserving unchanged legacy images. Social set-ai-image resolves an owned asset record rather than trusting a URL. This changes only attachment validation, not OAuth, provider configuration or publishing/approval execution.

Extended the explicit backfill operator script to image assets, including mismatched Blog generated-image references. Rehearsal and mocked real-handler tests cover old writes, foreign references, authorization before provider use and forged Social image URLs. No real generation, upload or publication was performed. Asset usage registry, source snapshots and consent/delivery review remain outstanding.

## 2026-09-11 Newsletter audience and approval ownership

Continued after the image milestone: recipient selection now requires stored series workspace and client-workspace membership in every mode. Estimates, approvals and delivery pass that context. New approval snapshots bind workspace identity; foreign snapshots abort before recipient resolution/provider access, and missing legacy ownership is only allowed in single-company compatibility mode. Retries bind client ID plus normalized email instead of email alone. Conservative opt-out/suppression behavior is preserved.

Release gate: reconcile existing client-workspace mappings before deployment, because unmapped contacts are excluded. No production send, token issuance, provider call or real scheduled execution was tested. Global group/consent semantics, campaign ownership and remaining concurrency/job/analytics paths still require work. See editorial-assets-audiences document for scope and limits.

Combined verification: 416 tests passed, zero failed; Prisma generation, non-incremental TypeScript, focused lint and diff checks passed. New actual-handler tests use mocked services, and migration/backfill tests use isolated PGlite. The result is draft implementation evidence, not hosted QA or full tenant-isolation proof.

## 2026-09-11 communication group ownership expansion

Continued after #225: additive nullable group ownership, scoped manual creation/rename/deletion, client membership validation for whole edit batches, scoped directory/options counts, and group ownership in newsletter recipient resolution. Newsletter series updates now take authenticated workspace identity and validate target/audience before approval or scheduling changes. Existing global safety-group writers remain untouched; legacy compatibility requires an unambiguous single-company installation.

Added executable membership-route and series-update tests plus isolated SQL old/new-write rehearsal. Full suite: 419 passing; non-incremental TypeScript, focused lint and diff checks passed. Hosted QA, verified historical group mapping, concurrency review, remaining campaign/lifecycle mutations and global consent policy remain open. See communication-groups document. No production deployment, database migration or delivery was run.

## 2026-09-11 Newsletter lifecycle authorization and stale-write protection

Continued after draft #226: scoped pause/resume transactions, actor-bound manual generation, stored-company block AI settings and stamped source snapshots. Moved block updates into the revision/approval transaction. Added row-version guards to save, approve, block rewrite and full-generation completion, with conditional failure handling that preserves a newer edition state. No protected OAuth/provider adapter changed.

Verification: 423 tests passed, zero failed; non-incremental TypeScript, focused lint and diff checks passed. Actual-handler tests mock dependencies; they do not prove database concurrency or hosted workflow parity. Remaining delivery/lifecycle concurrency, historical snapshot reconciliation and full tenant-isolation gates remain open. No production migration, deployment, campaign or live AI call performed.

## 2026-09-11 public project and media boundaries

Continued after draft #227. Found and scoped global public project-detail/metadata queries, including preview targets. Filtered referenced hero/thumbnail/social/collection media by workspace and public visibility, service-project joins/counts by company, and admin media selections. Scoped thumbnail repair writes and checked same-project hero identity in editor/publish readiness. Preserved existing layout and gallery hotfixes.

Verification: 425 tests passed, zero failed; non-incremental TypeScript and diff checks passed. Focused lint found an unused workspace binding introduced in the page wrapper; removed it. Executable query/repair tests use mocked data access. Hosted browser/SEO checks, inconsistent-reference inventory and comprehensive relational ownership remain open. No production deployment or database operation executed.

## 2026-09-11 FAQ authorization and ownership

Continued after draft #228. Added nullable ownership to FAQ category roots and local editor authorization to every FAQ/category mutation. Scoped reads, reorder, writes and source/destination category checks. Public/admin FAQ queries no longer return another company's categories; existing unassigned content has single-company-only compatibility.

Verification: 428 tests passed, zero failed; Prisma generation, non-incremental TypeScript, focused lint and diff checks passed. Route tests use mocked dependencies and migration tests use PGlite. Historical mapping, slug contract migration and hosted/browser verification remain open. No production data or deployment changed.

## 2026-09-11 legal document ownership and settings binding

Continued after draft #229. Added nullable legal-document ownership, local administrator authorization, company-bound document/settings transaction predicates, scoped public/admin readers and sitemap legal entries. Legacy default-settings writes require one matching company. Preserved all legal copy and global type uniqueness pending a controlled contract migration. Also scoped sitemap hero-media references.

Verification: 431 tests passed, zero failed; Prisma generation, non-incremental TypeScript, focused lint and diff checks passed. Actual-handler tests mock data access; SQL rehearsal uses PGlite. Historical mapping, uniqueness rollout, broader settings ownership and hosted/browser QA remain open. No production data, legal text, deployment or external delivery changed.

## 2026-09-11 CTA ownership and placement isolation

Continued after draft #230. Added nullable CTA ownership, local editor authorization and scoped CRUD/placement predicates. Public lookup requires company ownership. Preserved existing CTA text, booking destinations, legacy writes and global slot uniqueness; foreign occupied slots cannot be reassigned by the scoped upsert.

Verification: 435 tests passed, zero failed; Prisma generation, non-incremental TypeScript, focused lint and diff checks passed. Refetched main and confirmed 72dab34568cb6885f3e93b5ed9db38edca156835, matching the previously reconciled hotfix state. Hosted/browser evidence, historical mapping and tenant slot uniqueness remain open. No production database/deployment/booking operation ran.

## 2026-09-11 settings write targets and media ownership

Continued after draft #231. Removed global settings overwrite/reassignment paths, added shared company targets and distinct tenant row IDs, and updated legal publication settings to use them. Added local administrator checks to every settings presign route, company namespaces, server-derived image URLs and hero URL ownership checks. Physical image cleanup is deferred pending asset usage/recovery evidence.

Verification: 439 tests passed, zero failed; non-incremental TypeScript, focused lint and diff checks passed. Mocked actual-route tests check keys before storage, URL canonicalization, presign permissions and target identity. One test initially hit the VM's separate Error class; corrected the harness to match the single application realm and re-ran the full suite. No production settings, object, deployment or provider configuration changed. Actual uploads/browser flows, rollback namespace compatibility and remaining global consumers remain open.

## 2026-09-11 repeatable Phase 0 ownership inventory

Continued after draft #232. Added a source-only inventory generator and checked-in schema-hashed snapshot covering all 111 models, 138 route files, detected server actions and six configured cron routes. Recorded explicit foreign keys, nullable/required ownership, uniqueness and lexical call sites. The snapshot deliberately labels semantic review outstanding; required fields are not counted as proof of isolation.

Ran the generator and reconciled its 111-model count with schema declarations. No database or environment values read. Main remaining content roots and platform/shared-data decisions are documented in the current-state audit. Next implementation follows immutable email-campaign ownership and the remaining public content roots; protected integration behavior stays intact. No production action performed.

## 2026-09-11 stored email campaign ownership

Continued after draft #233. Added nullable campaign ownership and populated manual, Blog and Newsletter creation paths. Scoped history/drafts/scheduling and audience selection; delivery uses stored context and client membership before tokens/provider calls. Newsletter retry linkage is checked. Dashboard newsletter/email paths now use stored ownership. Added single-company campaign-admin containment while protected sender/consent/webhook paths remain unresolved.

Verification: 443 tests passed, zero failed; Prisma generation, non-incremental TypeScript, focused lint and diff checks passed. Re-ran focused ownership tests after adding explicit multi-company admin rejection coverage. Refreshed the inventory: 29 required, 11 nullable and 71 models without direct workspace fields. No Resend adapter, webhook handler, preference-token layer, live message, production migration or deployment changed. The existing webhook/bounce creator-derived association is a release blocker, not silently treated as completed isolation.

## 2026-09-11 About and public team ownership

Continued after draft #234. Added nullable About/team ownership, scoped reads and editor mutations, company asset namespaces and retained cleanup. Reused a generic singleton target while preserving the settings helper interface. Tenant About fallback is now explicitly empty, and the public page no longer substitutes Helios images when tenant content is absent.

Verification: 447 tests passed, zero failed; Prisma generation, final non-incremental TypeScript process exited successfully, focused lint and diff checks passed. Corrected an initially invalid generated fallback type and nullable-image value identified by the new test. Tests remain local/mocked or PGlite; hosted browser and actual upload evidence are pending. Refreshed model inventory. No production data, image, deployment or protected integration change performed.

## 2026-09-11 imported review curation integrity

Continued after draft #235 and returned to the handoff's critical review item. Added scoped row locking before linkage reads, same-workspace existing-testimonial validation, conditional link updates and idempotent repeated curation. Added a read-only mismatch preflight. OAuth/token/sync/provider code is untouched; curation still creates unpublished drafts.

Verification: 450 tests passed, zero failed; final non-incremental TypeScript, focused lint and diff checks passed. Corrected the nullable unique-field predicate to Prisma's general AND filter after TypeScript identified its unique-selector restriction. Concurrent-handler tests use a serializing mock; preflight runs on PGlite. Real Neon lock/contention and revocation races remain unverified. No production curation, migration or provider call performed.

## 2026-09-11 brand expansion and legacy writer compatibility

Continued after draft #236. Revised the unapplied draft brand migration to nullable expansion with restricted workspace deletion. New code continues writing ownership; sole-company, flag-off compatibility includes null rows, while tenant/multi-company paths exclude them. Retained global external-review uniqueness for old readers. Added explicit per-record reconciliation with atomic completeness and review relationship validation. Documented target migration checksum verification, writer draining, rollback namespace compatibility and the separate contract gate.

Verification: 451 tests passed, zero failed; generated local Prisma client reflects nullable ownership, non-incremental TypeScript and focused lint passed. Initial datasource-configured generation was blocked by a network approval cancellation; generation with a local config containing only the schema produced the client without loading any datasource or environment. SQL tests verify omitted-column legacy inserts and reconciliation rollback/idempotency in PGlite. No hosted migration or full application-overlap rehearsal occurred. Refreshed inventory to 27 required, 15 nullable and 69 models without direct ownership. Production remains on hold.

## 2026-09-11 inquiry ownership and notification containment

Continued after draft #237. Added nullable stored inquiry ownership, scoped public capture/services/rate limits, admin list/export/workflow/notes and dashboard activity. Child mutations lock the scoped parent inside their transaction; assignees require same-company active access. Contained global notification configuration and unfinished referral administrative paths to legacy single-company operation. Referral inquiry/client links now check company boundaries.

Verification: 457 automated tests passed, zero failed; generated Prisma client, final non-incremental TypeScript, focused ESLint and diff checks passed. Actual-handler tests cover foreign records, roles, assignment, export, rejected tenant delivery and preserved mocked Helios notification calls. PGlite verifies expansion and ownership independent of reassignment. No live notifications, webhook/provider changes, migration or deployment. Company notification setup, explicit backfill, referral cron/public-token isolation and hosted/browser concurrency evidence remain open. Inventory: 27 required, 16 nullable, 68 without direct ownership.

## 2026-09-11 project preview and media authorization

Continued after draft #238. Scoped preview issuance/revocation and public token usage to company ownership, added editor permissions and active tenant-domain URL selection. Preview creation locks its project and token usage conditionally rechecks expiry/revocation. Adjacent route review found missing local Stream/media authorization; added checks before provider access and scoped media deletion. Physical R2/Stream cleanup now remains pending until exclusive ownership can be proven by the asset registry.

Verification: 462 tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Handler tests cover foreign projects, viewer rejection, token revocation, domain ambiguity, unchanged mocked Tus provisioning and retention of corrupt foreign storage references. No actual token issued, asset removed, Stream/R2 call, domain change or production deployment. Provider adapters/configuration were preserved. Hosted locking/browser checks, complete media UID ownership and durable cleanup remain open.

## 2026-09-11 immutable audit context

Continued after draft #239. Added nullable AuditEvent ownership, explicit authenticated call-site attribution, known-account auth attribution and stored campaign context for delivery events. Activity access now requires company administrator permission; activity/dashboard/portfolio-event queries use stored scope. Missing ownership remains unclassified rather than being inferred from an actor or metadata. Integration-route changes only add audit context and preserve their provider/token behavior.

Verification: 465 tests passed, zero failed; Prisma generation, final non-incremental TypeScript, focused lint and diff checks passed. Actual helper/page tests and PGlite cover explicit context, unknown-event exclusion boundary, administrator visibility, retained legacy writes and account movement. Audit history mapping, remaining background/webhook writers, platform-event policy and guaranteed audit persistence remain open. No live auth/provider/message, migration or deployment action. Inventory: 27 required, 17 nullable, 67 without direct ownership.

## 2026-09-11 client portal ownership and provider containment

Continued after draft #240. Added nullable ClientPortal ownership with challenge inheritance, scoped public/admin reads and metadata, administrator-only configuration, scoped default/reorder/delete changes and per-company default locks. Public challenge verification and registration now bind records to the resolved company. Existing HDPhotoHub/email configuration is contained to the sole matching legacy company; company-owned external links remain available.

Verification: 472 tests passed, zero failed; Prisma generation, final non-incremental TypeScript, focused ESLint and diff checks passed. Executable handlers cover foreign portal/default mutation, foreign challenge/registration, external links, provider containment and preserved mocked verification-email creation. PGlite verifies additive expansion and retained challenges. Provider adapters, token formats, credentials, destinations and live accounts were not changed or called. Tenant provider configuration, verified historical mapping, concurrent registration/default browser rehearsals and full white-label copy remain open. Inventory: 27 required, 18 nullable, 66 without direct ownership.

## 2026-09-11 referral campaign ownership foundation

Continued after draft #241. Added stored nullable campaign ownership, workspace audience validation, scoped dashboard/API/public/test-link queries, server-owned creation and a version guard for approval snapshots. Preparation checks stored owner and snapshot context; delivery checks recipient/company relationships and approval state at claim. Existing provider execution remains single-company contained and unsupported work is preserved for reconciliation.

Verification: 482 tests passed, zero failed; Prisma generation, final non-incremental TypeScript, focused ESLint and diff checks passed. New executable tests cover foreign audience/IDs/links, server-owned creation, stale approval, foreign snapshots, foreign delivery and preserved mocked legacy delivery. PGlite verifies expansion. Two additional old source contracts requiring creator-derived association failed initially and were updated to stored scope; stale-launch, diagnostic and other behavior assertions remain intact. No messages, publishing, provider/consent changes, production migration or deployment occurred. Referral lifecycle and full hosted workflow gates remain open. Inventory: 27 required, 19 nullable, 65 without direct ownership.

## 2026-09-11 Stream asset registry foundation

Continued after draft #242. Added required immutable workspace/provider identity for new assets and nullable Media linkage. Stream provisioning now saves an intent before the existing provider request and binds the response video ID before returning the upload URL. New attachment checks registry ownership/status; unknown old uploads are constrained to sole-company flag-off compatibility. Added client header handling while retaining legacy resume fallback. No actual upload, provider deletion or credential change occurred.

Verification: 487 automated tests passed, zero failed; local Prisma generation, final non-incremental TypeScript, focused ESLint and diff checks passed. The first typecheck exposed generated relation-inference failures and an ES2018-incompatible test literal; preserving the existing Media field order and using the BigInt constructor resolved them. Executable handlers/helpers and PGlite cover foreign IDs, status rejection, binding failure, legacy writes and identity constraints. Actual Tus/browser resume, processing readiness, hosted migration and full relational/lifecycle enforcement remain gates. Inventory now has 112 models: 28 required, 19 nullable and 65 without direct workspace fields; counts do not demonstrate complete isolation. Production remains on hold.

## 2026-09-11 testimonial and logo upload registry adoption

Continued after draft #243. Added durable registration before brand-image URL signing/direct upload and company/status evidence before create/update attachment. Existing scoped legacy images remain unchanged; foreign namespaces and known forbidden records cannot use compatibility. Provider failures retain failed intents, and physical cleanup remains deferred. Sanitized upload preparation errors so database internals are not returned to the browser.

Verification: 492 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Executable tests cover server-owned keys, roles, registration ordering, collision/failure handling, foreign/unknown/status checks and legacy continuity. No provider calls or schema changes in this slice. Stored sizes are declared, provisioned does not mean validated bytes, and single-use uploads, full usage relationships, other upload families and actual hosted/browser evidence remain open.

## 2026-09-11 Photo Finishes ownership and legacy containment

Continued after draft #244. Added editor enforcement, registry-backed company upload keys, validated image attachment, exact scoped legacy continuity, public filtering of identifiable foreign references and empty tenant defaults. Helios pricing/example fallback now requires the sole legacy workspace. Added transactional save-conflict checks and returned persisted pair IDs so the editor can save repeatedly. Existing public layout and recent gallery changes were preserved.

Verification: 496 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Corrected an empty-template type assertion identified by TypeScript. Executable tests cover roles, foreign images, fallback containment, scoped writes and conflicts; editorial-style regression assertions still pass. Actual browser uploads/save-reopen, hosted concurrency, historical image attestation and complete registry lifecycle remain gates. No production/provider/migration action occurred.

## 2026-09-11 film comparison relationship integrity

Continued after draft #245. Replaced global placement upsert with transaction-scoped relationship validation and explicit owned create/update. Added editor enforcement, company locking before featured selection, scoped admin/public placement reads, poster-reference filtering and a read-only relational mismatch preflight. Existing valid classification and removal remain supported; no provider adapter or public layout was changed.

Verification: 502 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Actual handlers/page and PGlite cover foreign relationships, roles, mutation ordering, scoped predicates and preflight failures. Real multi-connection concurrency, browser classifier behavior, legacy-writer draining, role-revocation races and historical asset attestation remain gates. No migration, live classification, provider call or deployment occurred.

## 2026-09-11 Social Studio content and review authorization

Continued after draft #246. Added locked workspace/editor/session revalidation, scoped versioned content editing, atomic media-presentation and AI-cover updates, snapshot invalidation, unclaimed-job cancellation and in-flight editing rejection. Draft creation and review transactions recheck permissions. Review/update predicates retain the variant company and read version; media selection preserves requested order. OAuth/token/provider adapters and workers were not changed or called.

Verification: 509 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Updated the old AI-image test to execute the relocated shared editing logic while retaining foreign-ID and forged-URL assertions; updated one source contract to follow the media query into the helper. New tests exercise permission/version/ownership and review-state behavior with mocks. AI text writes, publishing snapshot creation/execution validation, duplication relationships and full browser/database concurrency remain critical next dependencies. V2 is not release-ready.

## 2026-09-11 Social AI generation ownership and stale-result guard

Continued after draft #247. Added permission-checked request claims, conditional failure recording and completion checks for company, request and original content version. AI text now uses the shared guarded editor inside its completion transaction, revoking superseded approvals instead of writing variants directly. New tenant defaults and model identity no longer assume Helios or Northern Colorado. Existing model/grounding/provider configuration was preserved.

Verification: 513 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. New helper/handler tests use fake model responses and cover foreign/stale/duplicate claims, late failures, tenant identity and rejected/successful application. No actual model/provider call, migration or deployment. Generation lease recovery, historical AI context, global request-ID uniqueness and publishing snapshot/worker verification remain open.

## 2026-09-11 Social publishing approval and ownership reservation

Continued after draft #248. Queue creation now checks current access and approval inside the transaction. The worker reserves only a matching company, approval, schedule, media and snapshot before token decryption; stale jobs cancel, disabled destinations wait and expired credentials require reauthorization. Shared mutation locks guard edits/review/schedule/archive against executing publication. Admin job actions recheck role and conditional state. JSONB payload normalization preserves existing digest ordering and provider idempotency. Also closed Stream registry attachment through external URL creation/replacement, preserving unchanged legacy references.

Verification: 522 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Tests use fake tokens/providers and mocked persistence; no live publication occurred. Protected-layer rationale, mock-provider evidence and outstanding hosted concurrency, recovery, historical asset and approved staging-provider gates are in `helios-studio-v2-social-publishing-guard.md`. Provider adapters, OAuth/token implementations and production state remain unchanged.

## 2026-09-11 Social campaign duplication integrity

Recovered draft #249 from GitHub after the runtime outage; its tree matched the saved checkpoint. Preserved the older checkout's unrelated image edit. Added transaction-authorized duplication with company validation of source projects, linked projects and campaign/variant media. Copies refresh source facts through owned queries, reject ambiguous IDs, retain authored content and media presentation, and omit old approval/schedule and unverified AI cover metadata.

Verification: 524 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. Updated existing route-test dependency maps without removing their authorization assertions. Prisma generated local artifacts, but its process subsequently reported cancelled network approval; no database access or bypass occurred. Hosted concurrency, browser copy/reopen, historical asset attestation and complete source typing remain gates. See `helios-studio-v2-social-campaign-duplication.md`. No deployment or integration change.

## 2026-09-11 Social campaign creation and settings access

Continued after draft #250. Moved project authorization and source-fact reads into the campaign creation transaction after fresh actor authorization. Required a record for typed project/portfolio/blog/newsletter sources and rejected unmodelled record IDs for other source types. Campaign settings edits now revalidate current workspace/editor access inside their write transaction. Invalid references produce a bounded conflict response; no campaign is created from them.

Verification: 526 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. New executable handler tests cover input ambiguity, revoked access, unavailable projects/sources, session company enforcement and permission-before-read/write ordering. Mocks do not prove hosted concurrency. Source ownership transfers and historical cached context remain gates; provider/OAuth/publication behavior was not changed.

## 2026-09-11 Social editor media read isolation

Continued after draft #251. The campaign editor now uses the authenticated session's company directly. Nested selected media and generated-asset queries are scoped; media is checked again for company, visibility and known storage namespace before serialization. Generated covers require a matching owned asset and, where present, an owned visible source-media relationship. Unattested legacy cover URLs are hidden until reconciled or reselected. The media fallback label is company-neutral.

Verification: 528 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. Executable page tests cover foreign relations, forged storage prefixes, missing sessions/campaigns, cover provenance and safe connection projection using fake persistence/JSX. Actual browser rendering, historical asset attestation and cached source facts remain gates; no integration or production change.

## 2026-09-11 Social generation source context

Continued after draft #252. Added one source-context resolver for duplication, editor facts and AI claims. Typed sources are reloaded through existing owned project/blog/newsletter queries; ambiguous or unmodelled references are rejected. Blank/media-only campaigns receive no cached property facts. Generation records the refreshed facts with its conditional request claim and passes that same context to the existing model flow. Invalid sources return a conflict before any model request. The editor describes the refresh behavior and no longer exposes historical cached fact JSON.

Verification: 530 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. Tests execute actual source query helpers and mocked handlers/transactions, covering all four typed sources, foreign or unavailable sources, malformed IDs, blank context and no-provider behavior on a rejected claim. React review kept data access server-side and the client change to explanatory copy. Historical authored text, source transfer races, provider model output and actual browser behavior remain gates. No live model call, database migration or deployment occurred.

## 2026-09-11 Social recurring-series authorization

Continued after draft #253. Series creation and its initial occurrence generation now share an authorized transaction. Further generation, archival and rescheduling revalidate workspace/editor access and lock the owned active series. Generation retains duplicate prevention and scopes its final update. Rescheduling accepts only unassigned occurrences with neither a campaign nor variant; linked content must follow its own review workflow. Creation validates end dates and time zones before writing.

Verification: 533 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Executable tests cover denied access before reads/writes, missing owned series, planning order, unassigned predicates and shared transaction use. Mocks do not prove rollback or multi-connection concurrency. Recurrence horizon limits, time-zone/DST parity and independently moved occurrence regeneration require further operational review. No publishing adapter, token, migration, delivery or production state changed.

## 2026-09-11 Website settings asset registry

Continued after draft #254. Extended the existing registry wrapper to site-brand, site-homepage and site-hero namespaces. All six settings presign routes now create ownership records before signing and withhold upload responses when registration fails. Settings saves verify registry ownership/status before attachment, including unchanged known assets; existing scoped legacy references remain compatible. Hero media permits only explicit video MP4/WebM and poster JPG/PNG/WebP/AVIF names. Replacement cleanup remains deferred.

Verification: 540 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Executable tests cover each upload route's owner/key/provisioning order, registration failure, foreign/quarantined hero assets, allowed/disallowed hero formats and settings-write rejection. These are fake provider/persistence tests. Registry provisioning is not completed-upload, MIME, byte-size or immutable-content attestation. Existing upload limits and provider configuration are preserved; no actual upload, migration or production action occurred. Site-settings transaction/revocation races, about/team assets and full lifecycle reconciliation remain gates.

## 2026-09-11 About and team asset registry

Continued after draft #255. About and team portrait uploads now register company ownership before signing. Their save paths verify registered owner/status even for known unchanged images, preserving only authorized legacy compatibility. Foreign prefixes are still rejected before registry/provider access; failed registration never returns an upload URL. Existing content and cleanup behavior are preserved.

Verification: 543 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Tests cover both upload handlers, registration failures, rejected team creation and rejected About attachment before writes. Actual uploads, image bytes, completed-upload status, save/reopen browser checks and transactional role-revocation races remain gates. No model/provider call, migration or deployment occurred.

## 2026-09-11 Blog featured-image ownership evidence

Continued after draft #256. Direct blog uploads now register ownership before signing, and featured-image saves validate registry owner/status. AI featured images require an owned NewsletterImageAsset record with the exact storage key before object access; their URLs are server-derived. This reuses existing AI image persistence without changing its provider or delivery layer. Authorized unchanged legacy images retain the established compatibility behavior.

Verification: 545 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Executable handler tests cover foreign and unregistered uploads, unavailable AI image records, owned AI attachments and signing order. Blog's single-company containment gate remains in place and is not evidence of multi-company workflow readiness. Full transactional mutation authorization, historical AI image reconciliation, browser upload/save/reopen and byte/lifecycle attestation remain gates. No live generation, upload, migration, delivery or deployment occurred.

## 2026-09-11 Manual blog write and revision authorization

Continued after draft #257. Manual create/save/delete now revalidate workspace/editor access in their write transaction. Featured-media references are rechecked as owned and visible there. Save and revision restore compare the current row timestamp in the update predicate; revision selection and the pre-restore snapshot now occur inside the authorized transaction. Successful restore refreshes article and listing caches. Removed duplicate session lookup from creation so validation and stored ownership use one actor.

Verification: 547 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Executable tests cover stale access, foreign media, conditional update conflicts, scoped deletion, owned revision selection and cache refresh. Mock transactions do not prove rollback or actual concurrent-writer behavior. Displayed editor-version submission, hosted races, series/AI write paths and single-company containment remain gates. No customer records, actual revisions, provider calls, migration or deployment were changed.

## 2026-09-11 Blog series authorization and stale generation

Continued after draft #258. Blog series settings writes now revalidate the actor in a transaction. Generation takes an explicit admin actor or background claim context, resolves stored ownership, rejects ownerless rows in tenant mode, and rechecks the active series before model access. Completion conditionally advances the captured series revision/schedule before creating the review-only draft and revision in the same transaction. Revoked admin access or intervening changes reject completion. Cron claim and retry restoration predicates retain stored company and claim timestamp, preventing older failures from resetting newer work.

Verification: 552 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Tests use fake model responses and mocked transactions to cover pre-provider denial, post-provider revocation/conflicts, review-only drafts, explicit background ownership, scoped cron restoration and series settings permissions. This changes orchestration around the existing model adapter, not model/prompt/provider configuration or cron authentication. No real generation or schedule mutation occurred. Hosted rollback/concurrency, interrupted-claim recovery, duplicate model-cost prevention and full recurrence parity remain gates. Blog single-company containment is preserved.

## 2026-09-11 Shared AI image request ownership

Continued after draft #259. Newsletter, Blog and Social image handlers now pass the authenticated actor and their required role to the shared generator. It copies that actor/company context, revalidates permissions before the model request and upload, and rechecks authorization inside image-record persistence. Administrator-only entry points remain administrator-only after role changes. Revocation returns a bounded 403; if an upload preceded the final denial, the existing cleanup path targets only that request's generated key. Company ownership no longer follows a fresh account-to-workspace lookup mid-request.

Verification: 555 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Tests use fake model/R2 responses to cover initial role denial, stable actor snapshots, revocation after generation and after upload, scoped cleanup, and all three handlers' trusted context. Model, prompt, provider, attribution and image-format settings are unchanged. No real image generation, upload, cleanup deletion or integration configuration change occurred. Durable request claims, duplicate cost prevention, asset-registry integration for generated images, hosted races and browser behavior remain gates.

Repository review: refreshed main at `72dab34568cb6885f3e93b5ed9db38edca156835`; it is already an ancestor of this stack, with no main-only commits or missing hotfix diff. This checks repository ancestry, not production deployment status.

## 2026-09-11 Newsletter image selection references

Continued after draft #260. Newsletter image picker and managed-image saves now reject references in known foreign workspace, newsletter-upload and project namespaces, including traversal encodings. Portfolio keys must match their selected project's identity. AI image URLs are derived from the owned row's storage key rather than accepting its cached public URL. Existing database ownership scopes, pagination and project-cover ordering remain in place.

Verification: 558 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Executable picker and edition-save tests exercise corrupt references on otherwise company-scoped records and denial before writes. This is known-namespace validation, not historical storage provenance or byte attestation. Legacy unnamespaced keys still depend on scoped database ownership. Source manifests, custom uploads, transactional asset revalidation, browser behavior and hosted concurrency remain gates. Newsletter single-company containment stays enabled. No upload, send, provider configuration, migration or deployment occurred.

## 2026-09-12 Newsletter source image integrity

Continued after draft #261. The source collector rejects known foreign storage references and archived projects, validates visibility and project identity on featured/related media, and excludes metadata from unreadable featured media. Source-image saves now refresh the server-persisted source identities and match the selected candidate against current results for that block. A stale or submitted candidate list cannot establish current ownership or visibility.

Verification: 560 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. Executable collector and selection tests cover foreign storage, hidden featured metadata, mismatched service covers, absent current sources, changed URLs and another block's source list. Reads still precede the write transaction; concurrent source changes and complete delivery-time reconciliation remain gates. Custom uploads, historical asset provenance, browser verification and hosted concurrency remain outstanding. No model, upload, email, migration or deployment was executed.

## 2026-09-12 Newsletter custom upload ownership

Continued after draft #262. New Newsletter uploads use the collision-safe company newsletter namespace and register ownership before signing. Custom managed-R2 images require a usable same-company registry record before object verification. Unchanged authorized legacy references remain compatible; new unregistered legacy Newsletter uploads are accepted only with flags off in the sole matching company. Public external HTTPS URLs remain supported. Automatic image selections now require the same persisted/current source evidence as explicit source selections, closing a mode-switch bypass.

Verification: 564 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. Thirteen targeted checks passed after final URL namespace edge-case hardening. Executable tests cover presign registration failure, invalid company IDs, foreign/quarantined records, legacy compatibility, external URLs and save-path mode bypasses. Existing image-upload UI contract remains intact, with its obsolete namespace assertion updated. Registry provisioning and HEAD are not immutable-byte or completed-upload attestation. Actual upload/save/reopen, fresh transactional authorization, delivery reconciliation and hosted races remain gates. No real upload, object deletion, email, migration or deployment occurred.

## 2026-09-12 Newsletter save and approval transaction authorization

Continued after draft #263. Edition saves and approval/scheduling now carry a copied authenticated actor and revalidate administrator access inside the write transaction before conditional edition claims, revisions, approvals or jobs. Editor membership cannot inherit an administrator threshold from a legacy owner role. Revoked access returns 403, including the pre-test save path. Existing approval snapshots, row-version predicates and delivery adapter remain unchanged.

Verification: 566 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. Actual save/approval handlers prove fresh authorization occurs before writes and audit, with forbidden requests producing neither. Membership tests cover administrator/owner success and editor/revoked denial. Mock transactions do not establish hosted rollback or concurrency. This permission hardening is required because approval creates send work; no live approval, send job, email, migration or deployment was executed. Revoke/reschedule/cancel, duplication, generation and delivery-time authorization/reconciliation remain gates.

## 2026-09-12 Newsletter edition transition containment

Continued after draft #264. Revoke, cancel and reschedule now share a fresh-administrator transaction with company/version/state predicates. They reject sent, partially sent, retrying-delivery and generating states. Job rows are locked and checked for existing claims before approvals or pending jobs change; active claims produce a conflict and roll back the transition. Cancellation no longer marks an already-claimed worker as stopped. Successful changes invalidate approval and cancel applicable pending work together.

Verification: 568 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. Executable helper and route tests cover foreign ownership, stale versions, forbidden roles, protected states, job claims, trusted request context and 409 responses. Mock transactions verify ordering and predicates, not real rollback/deadlock behavior. Hosted concurrent scheduler/delivery rehearsal and interrupted-claim recovery remain release gates. This orchestration change prevents state resets during delivery without altering provider adapters, tokens, recipients or delivery payloads. No real approval, cancellation, schedule, job, send, migration or deployment was changed.

## 2026-09-12 Newsletter dashboard ownership

Continued after draft #265. Newsletter dashboard counts now use stored series ownership instead of the creator account's current company. The page also uses the same administrator/single-company containment guard as the API before querying totals. No visual layout or workflow controls changed.

Verification: 569 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. An executable server-page test checks stored ownership despite moved creator accounts and denial before count queries. The old source-contract assertion requiring creator-based filtering was updated to the ownership contract. Browser/render verification and removal of the single-company containment gate remain outstanding. No provider, database migration or deployment action occurred.

## 2026-09-12 Newsletter generation actor and claim context

Continued after draft #266. Full generation now requires an explicit administrator actor or background job/token context. Initial claim, captured edition and generation-run creation share a transaction. Administrator permission or the owned unexpired GENERATE job claim is checked again before output persistence. Initial claims also compare the captured edition version. Block rewrites copy the actor and revalidate administrator access before model use and inside completion. Manual saves/rewrites reject SEND_FAILED records so their existing delivery campaign and approved retry revision cannot diverge.

Verification: 571 automated tests passed, zero failed; eight focused lifecycle/generation checks passed after final failed-delivery guards. Final non-incremental TypeScript, focused ESLint and diff checks passed. Fake-model tests cover pre-model denial, post-model revocation, stable actor ownership, review-only completion and scoped cleanup; claim tests check type, token, company and lease predicates. Model/prompt configuration, cron authentication, notification adapter and delivery provider remain unchanged. No real generation, notification, schedule, job, send, migration or deployment was executed. Lease renewal/recovery, duplicate costs, current block-source reconciliation, manual-image carryover and hosted concurrent claims remain gates.

## 2026-09-12 Newsletter block source refresh

Continued after draft #267. Block rewrites now resolve stored blog/project/service/website identities through current company-scoped sources instead of trusting cached excerpts, titles and image manifests. Missing or mismatched sources fail before model use. Administrator-provided sources use the authorized block's authored copy. Rewrite context excludes cached image/source metadata, and successful rewrites update each scoped source snapshot with the facts actually supplied to the model.

Verification: 573 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. Executable helper and rewrite tests cover stale facts, missing current records, mismatched source kinds, safe manual context and scoped snapshot updates. The existing model/prompt configuration is preserved; only its source data is refreshed. Source changes during model execution, manual-image carryover and hosted transaction/browser verification remain gates. No real generation, provider call, email, migration or deployment was executed.

## 2026-09-12 Newsletter series settings write guard

Continued after draft #268. Series creation now captures the authenticated actor and revalidates administrator access before audience reads or writes. Settings updates lock the scoped series, nonterminal editions and dispatchable jobs before configuration/approval changes. Active generation, claimed jobs and active/retryable delivery states produce a conflict; pending send cancellations no longer include claimed workers. Audience validation and final series writes retain company predicates.

Verification: 575 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. Executable tests cover foreign/legacy identity predicates, denied access, active and retryable work, stable creation ownership, and unavailable audiences. Mocked locks are not hosted concurrency/deadlock proof. Settings changes during delivery are blocked to preserve existing approved campaigns and retry behavior; no provider adapter changed. Pause/resume provenance, delivery recovery controls, browser parity and hosted lock rehearsal remain gates. No real settings, audience, approval, job, email, migration or deployment was changed.

## 2026-09-12 Newsletter pause/resume claim preservation

Continued after draft #269. Pause/resume now use fresh administrator access and the scoped series lock. Pause cancels only pending jobs and records SERIES_PAUSED provenance, preserving existing worker claims. Resume is idempotent for active series and restores only pause-cancelled work matching the current edition date/type. Send restoration requires the current revision's matching unrevoked approval. Paused draft editions become awaiting-generation; a configured generation job already due may resume for a still-upcoming edition.

Verification: 578 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. Actual-handler tests cover preserved claims, unrelated/legacy cancellations, approval and date mismatch, repeated resume, paused drafts and revoked access. Legacy cancelled jobs without known pause provenance are deliberately not revived; release preflight must reconcile them explicitly. Active delivery may finish after pause, and hosted race/lease recovery and repeated recurrence-collision rehearsal remain gates. No actual pause, resume, job, generation, notification, send, migration or deployment was executed.

## 2026-09-12 Newsletter duplication and shared image validation

Continued after draft #270. Normal saves and duplication now share image-reference checks. Duplication authorizes before reads, validates copied images, refreshes owned source facts/candidates, then rechecks administrator access and locks the captured company/version before creating the review-only copy. Copies use collision-resistant cycle keys, preserve authored text, normalize NONE images, and omit approvals, jobs and delivery history. Source-free legacy blocks receive explicit administrator-content provenance. Original records are unchanged.

Verification: 580 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. TypeScript identified an inferred copied-block array type; adding the explicit Prisma input type resolved it. Executable tests cover invalid image URLs, foreign/unavailable sources and images, changed editions, revoked access, stable actor ownership and absence of copied approval/delivery state. Existing save-path image tests now execute the shared validator. Copies with unavailable source/media evidence fail closed; historical reconciliation, changes during preflight, hosted rollback and browser copy/save/reopen remain gates. No actual copy, upload, generation, send, migration or deployment was executed.

## 2026-09-12 Newsletter delivery approval relationships

Continued after draft #271. Delivery validates edition/revision/approval identity, current revision, revocation and intended date before recipient resolution. Retries must match the approved revision, verified content hash, campaign identity, subject/preview and stored edition/revision identifiers. First delivery also compares captured version/date/company and the specific active approval before campaign creation. Verified historical hashes remain supported.

Verification: 584 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. An interrupted TypeScript process was rerun successfully. Actual delivery tests reject inconsistent references before token/provider effects and exercise first delivery plus canonical/legacy retries with a fake provider. Resend configuration, adapter, preference tokens, payload construction and idempotency format are preserved. Existing retry execution claims, fresh delivery authorization, eligibility changes between batches, hosted concurrency and historical reconciliation remain gates. No real email, notification, migration or deployment occurred.

## 2026-09-12 Newsletter delivery execution context checkpoint, verification interrupted

Continued after draft #272. Local implementation added an explicit copied administrator actor or owned SEND-job/token context to delivery. Authorization occurs before recipient eligibility, inside the first/retry claim transaction and before each batch. Both first and retry sends conditionally move the captured version/state to SENDING; another SENDING execution cannot enter. Manual-send pending-job cancellation moved from the route into the authorized claim. Completion compares the captured execution version and company before recording the result.

Local evidence before the development environment disconnected: full automated suite passed 587 tests, zero failed; focused ESLint and diff checks passed. Final non-incremental TypeScript had not returned a verified exit. Subsequent runtime calls returned HTTP 409 environment_offline, "Environment is not connected." There is no supported running implementation job after this checkpoint.

Recovery publication was reconstructed from the verified #272 GitHub files and the successful local edit commands because the local working tree could no longer be read. Treat this as unfinished draft code, not a verified tree-equivalent publication. Reconcile with any surviving local edits, rerun tests and TypeScript, and review the entire diff before advancing. An attempted follow-up for friendly 409 delivery-conflict responses, formatting and an actual send-now route test could not be confirmed executed and is not included here.

Protected workflow reason: an existing retry campaign previously skipped the initial delivery claim, allowing concurrent executions and lacking fresh actor/job authorization. Resend adapter/configuration, tokens, recipient-selection rules, provider payloads and idempotency format remain unchanged. No real email, notification, job, migration, merge or deployment occurred.

Release gates: interrupted SENDING executions now require explicit reconciliation; automatic takeover is intentionally absent until provider acceptance and durable recovery evidence can prevent duplicates. Complete retry recovery/leases, between-batch eligibility refresh, final authorization-to-provider races, hosted concurrency/deadlock tests, historical reconciliation and actual browser/test-send QA before release. Single-company containment remains. Production is held for full readiness and Jake's QA.

## Recovery verification of draft #273

The development environment is available again. The recovered checkout was clean at remote commit `3a8cfc8b7563420b0b21b6f881367b6dbcb3e573`, tree `1375cf86d13deaded3cb3ff3bb517ab22fc83cb7`, matching the published recovery checkpoint. On this recovered tree, the full automated suite passed 587 tests with zero failures and non-incremental TypeScript exited successfully. This closes the interrupted local verification gap for the published checkpoint; it does not establish equivalence to any inaccessible pre-disconnection edits or hosted workflow correctness.

Delivery recovery, between-batch recipient eligibility, hosted concurrency, browser QA and the remaining roadmap are still outstanding. No merge, production migration, deployment or real send was performed.

## Newsletter batch eligibility and uncertain acceptance containment

Continued after draft #273 and successful recovery verification. Delivery refreshes existing company-scoped recipient eligibility before each batch, skips removed recipients before tokens/provider effects and scopes skip writes by campaign and pending/failed state. Provider success followed by persistence failure, incomplete receipts or uncertain provider errors now holds the edition for reconciliation instead of making the batch retryable. Explicit preflight configuration failures remain retryable. The API reports held/expired/busy delivery conflicts.

Verification: 591 automated tests passed, zero failed; final non-incremental TypeScript, focused ESLint and diff checks passed. A test-only TypeScript parameter property incompatible with Node's strip-types mode was replaced with a normal field/constructor before final verification. Actual-orchestration tests use fake providers and mocked transactions. Provider adapters, configuration, payload construction, preference tokens and idempotency format are unchanged. No real send, migration, merge or deployment occurred.

This prevents unsafe automatic re-entry but does not implement delivery recovery. Durable batch attempts, immutable receipts, reconciliation of uncertain acceptance, lease recovery, hosted races, final consent-check timing and browser QA remain gates. See the delivery reconciliation document. Production remains held for readiness and Jake's QA.

## Durable newsletter delivery attempt evidence

Continued after draft #274. A required-company NewsletterDeliveryAttempt record commits before provider execution, capturing execution/revision/batch/recipient identity, request hash and the existing adapter's idempotency key. Provider receipt IDs persist separately before recipient-state updates. Terminal observations and request identity are immutable; uncertain outcomes remain held even if recording UNCERTAIN fails. The new additive migration validates same-company/campaign relationships and rejects duplicate or stale execution identities. Existing history receives no inferred acceptance records.

Verification: 594 tests passed, zero failed; non-incremental TypeScript, Prisma client generation, focused ESLint and diff checks passed. PGlite exercised the real migration and constraints; fake-provider orchestration tests cover failed preparation, accepted receipts surviving later failures, and uncertain outcomes. The static ownership inventory was refreshed; its counts are not semantic verification. No production migration, actual send, merge or deployment occurred.

Provider lookup/reconciliation, controlled lease recovery, hosted migration and lock rehearsal, legacy campaign mapping and browser QA remain release gates. Old writers remain schema-compatible but cannot safely dispatch around new attempt evidence during rollback. Production remains held for readiness and Jake's QA.

## Newsletter delivery evidence review

Continued after draft #275. Added a read-only administrator API and transaction-scoped service for reviewing delivery evidence. Fresh access precedes stored-company reads; mismatched campaign/revision/attempt ownership fails closed. The report distinguishes accepted, uncertain, conflicting, rejected-only and historical observations without treating missing attempts as proof of non-delivery. Repair suggestions are suppressed when evidence conflicts. Responses omit recipient emails and provider credentials/receipt IDs and disable caching.

Verification: 598 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. Actual classifier, service and route tests exercise invalid receipts, multiple acceptance IDs, uncertain overlap, moved actor context, stale authorization, foreign relationships and bounded HTTP responses. Inventory refreshed to 139 routes; this is not a hosted authorization verdict.

This endpoint neither repairs records nor authorizes retries. Browser presentation, provider lookup, reconciliation audit history, version-checked repair, lease recovery and hosted transaction verification remain gates. No actual recipient mutation, send, migration, merge or deployment occurred.

## Audited repair of missing newsletter acceptance records

Continued after draft #276. An explicit confirmed administrator action now repairs recipient records backed by unambiguous stored acceptance receipts. It rechecks access, locks the scoped reviewed edition version, validates ownership/evidence and conditionally updates only PENDING/FAILED records without provider IDs, sent timestamps or delivery/webhook events. Conflicts, uncertain evidence, SKIPPED and historical send records are preserved. A mandatory same-transaction audit records repaired recipient and attempt identities. Repeating a completed repair is a no-op.

Verification: 600 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. Actual service and route tests cover authorization, stale versions, conditional-write conflicts, idempotency, mandatory audit errors and explicit confirmation. The shared review also suppresses suggestions for records carrying provider or webhook facts. Mock transactions do not prove hosted rollback or concurrent webhook behavior.

No live repair, provider call, migration, merge or deployment occurred. The action does not resume jobs, change edition state, rebuild aggregates, alter consent or authorize retry. Browser controls, provider reconciliation, aggregate reconciliation, lease recovery and hosted verification remain gates.

## Checkout recovery and newsletter recorded totals reconciliation

The old worktree's Git metadata and node_modules target were unavailable after the environment reset. Cloned the published #277 branch into `/workspace/scratch/dd93a0742694/helios-v2-recovered`. Its head `57fc4672fbccbbe8154b76ad35d411d33a2575ef` and tree `9649873667c4dee390550781e70ed173790fbbdb` match the saved checkpoint; every tracked source file matched the surviving old directory. Preserved that directory. Installed locked dependencies without install scripts and generated Prisma using an unused local placeholder database URL, without a database migration.

Continued after #277. Review now exposes stored versus recorded campaign totals. Explicitly confirmed reconciliation locks scoped edition/campaign/recipient records, rejects claimed jobs and unresolved acceptance evidence, and conditionally updates only aggregate counts and campaign row version. The mandatory audit stores before/after totals in the transaction. Repeated matching reconciliation is a no-op. No edition status, provider history, consent or job changes occur.

Verification: 603 tests passed, zero failed; non-incremental TypeScript, Prisma generation, focused ESLint and diff checks passed. Actual service/handler tests use mocked transactions, so hosted rollback and worker/webhook races remain unverified. No live reconciliation, real send, production migration, merge or deployment occurred. Browser controls, lease recovery, provider reconciliation and release rehearsal remain gates.

## Completion of fully accepted interrupted newsletter deliveries

Continued after draft #278. Added a confirmed administrator action that closes only SENDING deliveries with complete matching durable acceptance evidence for every already-SENT recipient. It preserves recorded send timing, conditionally advances edition/campaign versions, reconciles counts, closes expired SEND claims while clearing their tokens, cancels pending SEND work and requires an atomic audit. Active or missing leases, claimed non-send work, incomplete/history-only/uncertain/conflicting evidence and stale versions fail closed. No provider call or retry authorization occurs.

Verification: classifier, actual service and handler tests cover evidence rejection, fresh access, scoped locks, conditional writes, lease predicates, token fencing fields and required audit errors. 606 automated tests passed, zero failed; non-incremental TypeScript, focused ESLint and diff checks passed. These tests use mock transactions, not hosted rollback or scheduler/webhook race verification. The review interface, unknown-acceptance provider reconciliation and hosted concurrency rehearsal remain gates. No real send, live reconciliation, migration, merge or deployment occurred. Production remains held for readiness and Jake's QA.

## Newsletter delivery review interface

Continued after the accepted-completion checkpoint, now published as draft #279 (remote head `71fa054c0920f3b2c7ea72fdcd5f1959432b6cb0`, tree `22e1f41b10dd9c494a8b7678db949279aeb3511f`). Created an isolated worktree at `/workspace/scratch/dd93a0742694/helios-v2-review-interface`, branch `codex/v2-newsletter-review-interface`, preserving the recovered checkout.

Added an administrator edition panel with on-demand evidence loading, stored-versus-recorded totals, readable observation counts, and explicit confirmations for repair, totals reconciliation and accepted completion. Requests contain only the action and reviewed version. The API remains authoritative for access, ownership, leases and evidence. Pending requests prevent duplicate submission; failed mutations are never automatically retried. Failed refreshes invalidate displayed evidence. Successful reconciliation instructs the operator to reload the edition so editor status and server-rendered analytics do not silently stay stale. No recipient emails or provider receipt IDs are displayed.

Verification: 608 automated tests passed, zero failed; non-incremental TypeScript, Prisma generation, scoped ESLint and diff checks passed. New executable client tests cover edition URL encoding, minimal mutation payloads, uncached requests, foreign/malformed snapshot rejection, bounded errors and no automatic retries. These are not browser interaction tests. Keyboard/focus/mobile behavior, authenticated HTTP sessions, hosted concurrency and uncertain provider reconciliation remain gates. No real send, live record mutation, production migration, merge or deployment occurred. V2 remains incomplete and held for readiness and Jake's QA.

## Phase 2 dependency: contain ineligible newsletter send claims

Recovered the published #280 branch into `/workspace/scratch/dd93a0742694/helios-v2-jobs` after the prior recovered and review-interface directories disappeared. Verified head `82e9a2b6633255deeabd3f721aafc828eed1f9cb`, tree `0addd44aab12a5368edcb77042eb8c005f531f6d`. Installed locked dependencies without install scripts; generated Prisma against an unused placeholder URL without connecting to a database or migrating it.

Continued into shared job reliability while keeping incomplete Phase 1 gates open. SEND claim selection now excludes held/non-deliverable editions, absent approval references, mismatched/future schedules and PREPARED/UNCERTAIN delivery evidence before changing a job token or attempt count. Existing eligible retry states remain subject to all delivery-service authorization and approval checks. Generation and notification behavior is unchanged. This prevents reconciliation-held work from being reclaimed simply because its lease expired.

Verification: 609 automated tests passed, zero failed. The new test executes the actual scheduler SQL in isolated PGlite with two companies and checks eligible work, held evidence, stale schedules, paused series, active leases and repeated claims. This is not hosted concurrency evidence. The delivery-attempt migration remains a deployment dependency; no new migration was added or executed. Full lease heartbeat/recovery, tenant job ownership review, fairness, operational visibility and hosted/browser QA remain outstanding. No provider call, real send, live reconciliation, merge or production deployment occurred.

Final non-incremental TypeScript, Prisma generation, scoped ESLint and diff checks passed for this checkpoint. Production remains held for complete readiness and Jake's QA.

## Phase 2 dependency: claim newsletter work immediately before execution

Continued after draft #281 on `codex/v2-newsletter-worker-admission`. Verified the remote parent remains `3d69569935868026a7f4d3c3692d1baae9b479e7` and main remains `72dab34568cb6885f3e93b5ed9db38edca156835`. No merge or deployment was attempted.

The cron previously claimed ten jobs before sequential execution, so later jobs could spend their leases waiting behind slow work. It now claims one at a time, settles each before another claim, preserves the ten-job cap, and stops admitting work after a 30-second monotonic window including enqueue time. Execution context, delivery guards, provider adapters, notification recipients and cron frequency are unchanged. Jobs not yet admitted remain available to later invocations.

Actual handler tests with synthetic modules and a controlled clock cover sequential claims, the cap, slow success/failure, enqueue budget exhaustion, empty queues and unauthorized requests. No providers or recipients are contacted. This is admission control, not heartbeat, hard cancellation or proof that a single job finishes within the hosting limit. Hosted overlap, throughput, provider timeout alignment and durable generation recovery remain gates.

Verification: 612 automated tests passed, zero failed; non-incremental TypeScript, scoped ESLint and diff checks passed. No schema changed. Production remains held for complete readiness and Jake's QA.

## Atomic missed-approval processing

Continued after #282. Missed-approval jobs now resolve stored ownership and revalidate their current token, type, lease and exact elapsed schedule under locks. Edition status, approval revocation and a mandatory company audit commit in one transaction. Inactive series and ineligible edition states remain unchanged. The cron notifies only after the transition service returns a change. Provider adapters and notification routing are untouched.

Verification: 615 automated tests passed, zero failed; non-incremental TypeScript, scoped ESLint and diff checks passed. Service tests use synthetic transactions and cover captured job identity, owner/claim rejection, conditional versions, state preservation and approval/audit failure propagation. They do not prove hosted rollback or lock ordering. No migration, actual send, live mutation, merge or deployment occurred. Generation schedule validation is the next adjacent execution gap. Hosted concurrency, notification isolation and recovery remain gates.

## Background generation schedule validation

Continued directly after publishing #283, remote head `23ae3a5a623fcc144d5d92b25dbda6380a26e7b7`, tree `ae1c12ae8bce6d3cb5b00f545b59dd6f14ec9479`. Background generation previously validated ownership and lease but not the job's schedule identity. It now requires an elapsed job due date matching the edition's current non-null generation date, both before edition claim and before content persistence. Explicit administrator generation remains independent of scheduled jobs. No AI/provider adapter changed.

Expanded actual access-service tests cover missing/changed generation dates and the due-date predicate while preserving current-claim and administrator tests. Hosted schedule/claim races, heartbeats and recovery of abandoned generation runs remain unverified. No schema migration, actual generation, live mutation, real send, merge or production deployment occurred.

Verification: 615 automated tests passed, zero failed; non-incremental TypeScript, scoped ESLint and diff checks passed. Existing tests were expanded, so the test count is unchanged from #283. Production remains held for readiness and Jake's QA.

## Automated regression workflow foundation

Continued after #284 to address a release-evidence gap: the draft tree had no GitHub Actions workflows. Added V2 regression checks on main/codex branch pushes, pull requests to main and manual dispatch. The job uses read-only repository permissions, disables persisted checkout credentials, pins checkout/setup-node actions to verified commit SHAs, installs locked dependencies without lifecycle scripts, and runs Prisma generation, isolated tests, TypeScript and patch whitespace checks. Database URLs are deliberately unusable loopback placeholders. There is no deployment, database migration or provider credential access.

Validation: workflow YAML parsed and event/permission/step structure checked locally; the exact application code previously passed 615 tests and non-incremental TypeScript. Action pins were resolved from the official actions/checkout and actions/setup-node v6 refs. No new full application run was needed for YAML/docs-only changes. GitHub execution and required-check enforcement still need verification. A configured workflow is not itself proof that CI ran or that branch protection enforces it. Hosted integration, browser, migration, restoration and production gates remain open.

The first GitHub run, https://github.com/heliosremedia/heliosremedia/actions/runs/34700032849 at `4eb69f6b401e9bfe60748098e185bd91496b765c`, independently passed Prisma generation, all 615 tests and TypeScript. Its whitespace step failed because checkout depth 1 made Git treat HEAD as a root commit and inspect pre-existing repository whitespace. Set checkout depth 2 so the intended parent diff is available. This corrects the CI harness; no application checks were removed. A new GitHub run is required to verify the corrected workflow.

Corrected GitHub CI passed: https://github.com/heliosremedia/heliosremedia/actions/runs/34700195471 verified commit `412cf6a75fe108f956347ccf6d0bca6ee68cf1bd`. Fresh-runner installation, Prisma generation, all 615 tests, TypeScript and parent-diff whitespace checks succeeded. Checkout depth 2 also passed a local shallow-clone rehearsal. This independently verifies the regression workflow and application checks, not hosted database behavior, browser QA, required-check enforcement or production readiness. This ledger entry is a documentation-only follow-up to that verified commit.

## Scheduled generation and deadline claim containment

Continued after #285. Extended scheduler admission checks to GENERATE and MISSED_APPROVAL jobs. Each must match the edition's current applicable date, be due, and have an eligible edition state before the job token or attempt count changes. GENERATING editions are not automatically reclaimed for generation. Ineligible, missing-date, stale and future jobs remain untouched for deliberate review; execution services retain their independent authorization checks.

Expanded the actual scheduler SQL test in isolated PGlite across two companies. It verifies eligible generation/deadline work and seven excluded scenarios retain old tokens and zero attempts. Focused SQL tests, scoped ESLint and diff checks passed locally. Full regression and TypeScript verification are delegated to the newly installed GitHub workflow for this draft, with results still pending at this commit. Hosted concurrency, abandoned-run recovery and operational visibility remain gates. No provider, migration, live mutation, merge or production deployment occurred.

## Generation execution evidence for recovery

Verified #286's GitHub run https://github.com/heliosremedia/heliosremedia/actions/runs/34702127828 succeeded at `5df0f27bf6d79a2fdb8668b53781fce2df219823` before advancing.

New generation runs capture execution kind, the claimed edition version and either the background job ID or administrator identity in the existing instructions snapshot. Raw claim tokens are excluded. Existing runs are not backfilled with inferred execution identities. Failure cleanup now updates only the matching edition's RUNNING generation record, preserving previously settled SUCCEEDED/FAILED observations when a late worker fails. Existing versioned edition cleanup is retained.

Focused actual-orchestration tests cover captured administrator/background identity, exclusion of claim tokens, model failure and preservation of settled run status/error evidence. Focused tests, scoped ESLint and diff checks passed locally. Full regression and TypeScript are pending GitHub CI for this draft. No schema migration, actual generation, live mutation, real send, merge or production deployment occurred. This supplies recovery evidence; it does not yet authorize resetting abandoned editions. Audited recovery, hosted concurrency and generation heartbeat remain gates.

GitHub independently verified this generation-evidence checkpoint: https://github.com/heliosremedia/heliosremedia/actions/runs/34702875226 succeeded for `e683404f092f44ec65752eb521db94eb281fdf78`, including full regression, TypeScript, Prisma generation and patch whitespace. The new test raises the suite to 616 tests. Recovery actions and hosted transaction verification remain outstanding; no production rollout is authorized by this CI result.

## Guarded recovery of expired background generation

Continued after #287. Added administrator review and explicit-confirmation recovery APIs for generation interruptions. Fresh administrator authorization precedes scoped series/edition/job/run locks. Eligibility requires exactly one RUNNING run, that run being latest, matching stored company/series/execution version, a captured BACKGROUND job with expired non-null lease, and no competing claimed work. Legacy runs without execution evidence, administrator runs, live claims, stale versions and ambiguous runs fail closed.

Recovery conditionally returns the edition to NEEDS_REVIEW, settles the run as failed with a recovery reason, clears the expired job token, cancels pending generation work, revokes current approval and requires a same-transaction audit. Blocks, revisions and historical records are preserved. No generation, email or provider operation is started; nothing is automatically retried.

Verification: four focused executable service/handler tests passed, plus scoped ESLint and diff checks. Tests cover evidence rejection, ownership, reviewed identity, conditional writes, token-clearing predicates and mandatory audit failures. Mock transactions do not prove hosted rollback or locking. The static ownership inventory was refreshed to 140 route files. Full tests and TypeScript are pending GitHub CI. Studio recovery controls, authenticated browser tests, hosted concurrency and old/new worker overlap remain gates. No production migration, live recovery, merge or deployment occurred.

GitHub verification succeeded for the recovery implementation at `cae95f506c869b5ea517217de70f9dd52c643d9e`: https://github.com/heliosremedia/heliosremedia/actions/runs/34703355257. The regression suite now contains 620 tests; the test, Prisma generation, TypeScript and whitespace steps all passed on the fresh runner. Recovery controls are currently API-only. Hosted rollback/concurrency and browser workflow remain release gates. This is a documentation-only follow-up to the verified implementation.

## Studio generation recovery controls and browser regression

Added the recovery panel to the edition workspace. Administrators load a current review, inspect recovery availability and explicitly confirm returning an expired generation to review. The panel posts only the reviewed version and run identity, prevents duplicate requests, clears stale evidence after failure and preserves unsaved editor content. Confirmation explains approval removal and cancellation of pending generation work. Successful recovery followed by a failed refresh remains clearly distinguished from a failed recovery. Existing single-company server containment remains in force.

Local verification: all 622 regression tests passed, TypeScript passed and scoped lint/whitespace checks passed before publication. New executable client tests cover strict response validation, session-owned API boundaries, encoded edition identity and bounded error responses. React review covered event-driven requests, abort cleanup, type-only server imports and confirmation accessibility.

Added a standalone synthetic browser fixture mounting the actual component with application CSS, plus browser assertions for keyboard focus, explicit confirmation, duplicate prevention, preserved editor notes, stale/access/blocked states, failed refresh and mobile overflow. The fixture replaces fetch with synthetic responses and is never mounted by the application. The runner binds an ephemeral loopback port and performs no database/provider work. Playwright and esbuild are development dependencies. GitHub regression now installs Chromium and runs this workflow automatically.

Local browser verification is blocked: agent-browser could not start its daemon; direct Chromium launch reports `socket() failed: Operation not permitted`. Browser installation was recovered through a verified TLS download, but the workspace runtime restriction remains. GitHub browser results are pending at this commit. A synthetic fixture does not establish authenticated HTTP, hosted database concurrency or deployed parity. No live recovery, migration, merge, provider call or production deployment occurred.

GitHub independently verified #289 at `a347a0b7b6f003bf85c0a3bdc0314f1a079b7ed9`: https://github.com/heliosremedia/heliosremedia/actions/runs/34704645086. All 622 regression tests, TypeScript, Prisma generation, whitespace and the real Chromium synthetic interaction workflow passed. Browser logs confirm confirmation, keyboard focus, duplicate prevention, preserved notes, stale/access/blocked states, failed refresh, mobile overflow and absence of runtime errors. These are actual browser interactions with synthetic API responses, not deployed or authenticated full-stack verification.

The same work block adds a database atomicity test executing the real recovery service through a narrow test ORM-to-SQL adapter inside PGlite transactions. A required audit failure rolls back edition, run, job and approval changes; a foreign-company attempt leaves every record unchanged; successful recovery preserves content and the second company's records; repeat recovery is rejected. The isolated transaction test passed locally. This strengthens rollback evidence but does not establish hosted Prisma behavior, concurrent locking or old/new worker overlap. The added test and documentation follow-up require fresh CI verification.

## Newsletter administrator notification containment

Continued directly from the recovery UI/database work into the adjacent tenant leak. Cron notifications previously passed edition labels to the global notification recipient without stored company validation. Added an ownership wrapper that reloads the edition, resolves stored ownership and permits the legacy notification adapter only when exactly one matching workspace exists. Missing, ambiguous or foreign ownership suppresses the notification. Labels and review links derive from the stored edition, not caller-supplied branding, company or URL fields.

Notification transport/lookup failure is ancillary and bounded: it no longer propagates into the job outcome after completed generation or accepted delivery. The existing Resend adapter, configuration variables, recipient selection fallback, email copy and provider request remain unchanged. Reason for this boundary change is preventing cross-company metadata leakage while retaining the working single-company integration. Tenant-specific senders/recipients remain unimplemented and multi-company notification is deliberately unavailable.

Seven focused executable notification/worker tests passed, plus scoped ESLint and whitespace. Tests exercise the real wrapper with a fake provider, reject absent/foreign/ambiguous ownership before provider invocation, exclude forged labels/URLs, bound errors and retain completed delivery success when notification is unavailable. No real email, provider connection, token, configuration, migration, merge or production deployment changed. Fresh full regression, TypeScript and browser CI verification are pending for this draft.

Recovery follow-up verification is complete: https://github.com/heliosremedia/heliosremedia/actions/runs/34704997156 succeeded at #289 head `dff6240ec496f18bad462bf1459c2d1d5ac8960d`. The added database transaction test brings that checkpoint to 623 tests. Regression, TypeScript, Prisma generation, Chromium workflow and whitespace all passed. Notification containment is a subsequent draft change and requires its own result.

Notification containment passed independent CI at `a13e2fb7b49dd54c1a8c794630f6550f5d2b8483`: https://github.com/heliosremedia/heliosremedia/actions/runs/34705172975. All 627 tests, TypeScript, Prisma generation, Chromium recovery workflow and whitespace passed. The ownership inventory was regenerated to include the new notification context consumer; counts remain 113 models and 140 route files. This follow-up changes documentation/inventory only. #289 and #290 remain draft and unmerged; no production verification is implied. Phase 2 reliability work has advanced, while Phase 1 multi-company exit gates, hosted preview/database verification and the later product/commercial phases remain open.

## Newsletter job visibility and unsupported-work containment

Recovered the clean local checkpoint and verified remote #290 remained draft at `d8b99945e99cfe99ef85f14485669e815dffd0ea`; main remained `72dab34568cb6885f3e93b5ed9db38edca156835`. Read the charter, roadmap, architecture, current-state audit and installed Next.js authentication guidance. The canonical implementation claim is now `docs/helios-studio-v2-run-claim.json` on branch `ops/v2-automation-control`. Future runs must read that single shared record and acquire it with an expected-blob-SHA update before editing. This avoids branch-specific locks that could miss competing work. Coordination commits do not alter main or the release branches.

Added a read-only Newsletter jobs panel to the Studio overview. A no-store administrator API rechecks current locked membership/account authorization and reads owned jobs through stored edition/series relationships in a repeatable-read transaction. Counts cover queued, active-lease, expired/missing-lease and failed work. The latest 50 unfinished jobs include safe labels, due times, attempts and domain status, with explicit truncation and review links. No claim tokens, raw errors, credentials, prompt content or retry authority are serialized. Failed refresh clears stale evidence; requests are on demand with duplicate and abort guards. An active lease is not presented as proof of worker liveness.

Review identified the reserved NOTIFY job type had no executor but could previously be claimed and reported complete. The scheduler now admits only its three implemented job types, and the worker rejects unsupported claims before loading editions or reporting success. The status panel still shows reserved notification jobs and explains they remain held. Existing provider adapters, notifications, approval and sending behavior are unchanged.

Nine focused executable service, route, client, worker and isolated PGlite scheduler checks passed, plus scoped ESLint and whitespace. The initial type check caught the missing NOTIFY display label; that compatibility case was corrected. Extended the existing real-Chromium synthetic workflow with read-only loading, duplicate prevention, encoded review links, mobile overflow and failed-refresh clearing. Full regression, final TypeScript and browser verification are pending GitHub CI for this draft. Inventory now tracks 141 route files. This is Phase 2 operational visibility with Phase 1 containment retained, not shared-job convergence or a tenant-isolation exit. No live job execution, migration, provider call, merge or production deployment occurred.


## Newsletter analytics ownership and server-page containment

Continued the same claimed run into analytics after finding the results helper queried globally by edition ID, including when rendered directly on the edition page. Analytics now requires a captured server actor, rechecks locked administrator authorization and scopes both current and previous deliveries through stored series ownership AND the linked email campaign's ownership. Corrupt cross-company campaign links cannot supply recipient events. Queries select only aggregate inputs, excluding recipient emails, raw provider payloads and other unnecessary personal fields. Unsubscribe aggregation uses only campaign IDs from those authorized deliveries; global consent behavior and webhook processing are unchanged.

The edition server page now uses the same single-company module guard as the API and passes only user/workspace/session-version fields to the analytics server component. The API explicitly supplies its verified session actor. Four focused executable analytics/core/page tests passed, including foreign editions, inconsistent campaign links, previous-edition filtering, permission rejection and safe actor propagation. TypeScript passed for implementation before the new test file; full final regression, TypeScript and browser CI are pending.

The initial #291 CI run 34706876729 caught an existing dashboard test harness that lacked the new client-component import and fragment composition. Fixed the harness without weakening its two-company count or pre-query denial assertions; the focused dashboard test passed. The fix is published to #291 at a35ef676f0f80c5b021e39d6cee68562ae2cb860 with fresh CI pending. No failing run is being counted as verified. This analytics change does not modify provider delivery, preference writes, OAuth or production. Authenticated hosted browser/Prisma parity and global preference attribution remain release gates.

Verification follow-up: #291 passed all 631 tests, Prisma generation, TypeScript, Chromium synthetic interactions and whitespace at `a35ef676f0f80c5b021e39d6cee68562ae2cb860`, run https://github.com/heliosremedia/heliosremedia/actions/runs/34707175962. #292 analytics passed all 633 tests and the same complete CI steps at `e99c359d9fa2ad79a3a07e81211bc54802e16360`, run https://github.com/heliosremedia/heliosremedia/actions/runs/34707274972. The 633-test suite also passed locally. Both remain draft and unmerged. These results supersede the pending statements above without erasing the earlier failure evidence.

## Recurring newsletter preparation serialization

Continued the same claimed run from #292 onto `codex/v2-newsletter-recurrence-serialization`. Discovery now reads only stored series identity and ownership. Preparation resolves that stored ownership, takes the shared workspace-then-series locks, verifies the ownership predicate in SQL, and rereads ACTIVE status and current scheduling configuration before writing an edition, jobs or next dates. A pause or ownership mismatch observed after discovery cannot authorize stale preparation. Ownerless content still requires the existing unambiguous single-company compatibility resolver; ambiguous ownership aborts preparation without guessing a company.

Previously prepared editions retain their stored generation/send dates when constructing missing idempotent jobs, including deliberate reschedules. No existing edition content or schedule is overwritten. Counts are accumulated only after a successful transaction. Existing job keys and duplicate suppression, approval semantics, worker execution and provider adapters are unchanged.

Five executable preparation tests exercise lock ordering, fresh active/ownership checks, legacy compatibility, ambiguous rejection, stored reschedule dates, manual generation and failure propagation. An additional test executes the real scheduler's lock SQL and writes through a narrow ORM-to-SQL adapter in isolated PGlite transactions: a final schedule-update failure rolls back the new edition and jobs; foreign ownership and a paused series write nothing; successful preparation preserves the other company; repeating preparation adds no duplicate work. The existing isolated claim SQL test also passes. This is database atomicity and executable service evidence, not hosted Prisma or multi-connection lock-race verification. Focused lint and TypeScript passed before the final database test addition; complete fresh CI remains pending for this draft.

Phase 1 exit gates remain open alongside Phase 2 reliability work. Next dependencies include generation heartbeat/lease semantics, shared-job convergence, broader jobs/media ownership review, authenticated full-stack tenant tests, hosted database concurrency and rollback rehearsal. Tenant-specific newsletter recipient/sender configuration and preference attribution still need review before removing single-company containment. Phases 3 through 7 and Jake's QA gate are not complete. Production remains held; no live generation, notification, campaign, migration, merge or deployment occurred.

Recurrence verification is complete at remote code head `6a68fa585fafcd481de2c90437a4092d2d54e55b`: https://github.com/heliosremedia/heliosremedia/actions/runs/34707861194 passed all 639 tests, final TypeScript, Prisma generation, Chromium workflow and whitespace. Local full regression also passed 639/639. The ownership inventory was regenerated and remains unchanged at 113 models and 141 route files. #293 remains draft/unmerged with #292 as its dependency. The focused test's failure injection proves isolated rollback, not actual hosted multi-worker locking. This documentation follow-up does not change application code.
