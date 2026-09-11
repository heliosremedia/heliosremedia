# Helios Studio V2 progress ledger

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
