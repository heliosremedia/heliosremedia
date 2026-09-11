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
