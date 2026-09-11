# Blog and Newsletter ownership paths

## Implemented

- Blog post mutations, revisions and series mutations now include an ownership predicate. Admin list/media reads and AI settings are scoped. Manual series generation checks the requested ID against the authenticated workspace before loading content.
- Blog's featured-media mutation validates project ownership. Public/admin featured-media reads and Newsletter related thumbnails discard inconsistent foreign references.
- Blog and sent-Newsletter sources in Social Studio now filter by ownership. Provider adapters, OAuth/token handling, destination selection and publishing execution are unchanged. This is a content-source authorization change required by the V2 roadmap.
- NewsletterSeries gains nullable explicit workspace ownership with a restrictive foreign key. New series record the verified actor workspace at creation. Editions inherit their owning series; changing the creator's account workspace no longer changes series ownership.
- Newsletter generation resolves stored series ownership before claiming work. An unowned legacy series is allowed only in flag-off single-company compatibility mode. Blog/project/service/settings selection uses that context; source URLs use company settings.
- Newsletter edition lookup uses stored series ownership instead of the creator relation. Gallery and saved Blog/project-media selections are scoped. Newsletter administrator APIs remain single-company-only because recipients, approvals, delivery and asset handling are not fully isolated.

## Legacy compatibility policy

`getContentOwnershipScope` includes null ownership only with the tenant flag off and exactly one matching workspace. All other cases require explicit matching ownership. This compatibility check is not sufficient for onboarding or concurrent tenant provisioning. The second-company gate remains closed.

The additive Newsletter migration leaves existing rows unassigned and accepts old application inserts. The existing global Blog slug uniqueness remains. A verified mapping, reconciliation after old writers stop, and separate constraint changes are required before activation.

## Explicit backfill rehearsal

`scripts/migrations/backfill-content-ownership.sql` is an operator script, not an automatic Prisma migration. On one isolated connection, prepare a temporary `ContentOwnershipMapping` table with non-null `kind`, `id`, `workspaceId` columns and primary key `(kind,id)`. Populate it only from verified per-record ownership evidence. Accepted kinds are BlogPost, BlogSeries and NewsletterSeries.

The script locks the three roots for the transaction, validates mapping targets and workspaces, refuses to change existing ownership, applies only null ownership, and requires complete coverage and matching Blog series/media references. It commits only if all checks pass. A failed invocation requires rollback of the aborted transaction before retry. It is idempotent for the same verified mapping. No production mapping has been collected or applied.

A hosted rehearsal must measure lock duration, connection/pooler behavior, old-writer overlap, backup restoration and all related counts. Do not run this on production until implementation readiness and Jake's QA sequence have completed. The script does not enforce non-null ownership against subsequent legacy writers.

## Verification and limits

Executable tests cover ownership scopes, immutable series ownership after creator movement, old/new schema writes, unknown and ambiguous generation context, actual Newsletter source collection with mocked dependencies, and the Newsletter single-company guard. The SQL backfill test exercises partial mapping rollback, conflicting series/media references, idempotence and attempts to reassign owned rows. An old source assertion requiring creator-based Newsletter ownership was updated to the new stored-ownership contract and supplemented with behavior tests.

This does not establish authenticated browser/hosted HTTP, live database or provider verification. The remaining Newsletter AI assets, groups/recipients, approvals, delivery/retry/analytics and other global reads still require conversion. Blog raw upload keys and image-generation paths need storage ownership review. Full tenant isolation, migration/deployment gates and release readiness remain incomplete.
