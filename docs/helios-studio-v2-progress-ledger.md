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
