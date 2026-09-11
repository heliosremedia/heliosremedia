# Blog ownership expansion

This is the expand stage, not complete Blog tenancy. Existing Blog admin containment remains in force.

## Data and compatibility

The new migration adds nullable Workspace foreign keys to BlogPost and BlogSeries and indexes their ownership. It performs no inferred backfill, drops no slug constraint and deletes no content. Foreign keys restrict workspace deletion. Old application inserts may omit ownership during the transition.

New manual posts and series record session ownership. Series-generated posts record their series workspace; a legacy unowned series can generate only when a single workspace exists. Generation sources and settings use that context; legacy unowned post sources are considered only for an unowned series in single-company compatibility mode. No provider call or scheduled execution was performed during development.

A verified historical per-record backfill, reconciliation of old-app writes, all remaining reader/writer conversions and a separate required-column migration are mandatory before multi-company activation. Existing global slug uniqueness remains until every lookup and link consumer is workspace-scoped. Nullable rows must never be made visible by a cross-company fallback.

## Public behavior

With the existing tenant flag enabled, Blog index/detail and sitemap queries require resolved workspace ownership. Ownerless rows are hidden. With the flag off, legacy public selection remains; this flag is not safe to enable until the remaining public roots and source consumers are converted. Draft preview checks require a session matching the public workspace and any explicit post ownership.

## Outstanding work

Newsletter and social sources, admin list/media/revision/AI paths, same-company media and series relationships, upload ownership, cron leasing, and company-specific metadata/defaults need completion. The existing single-company admin guard must not be removed early. This branch cannot enable a second company.

The production build still runs pending migrations. Keep all changes in draft until deployment gating, backups, hosted overlap rehearsal, feature-flag verification and Jake's QA sequence are satisfied. Migration SQL was exercised only in isolated PGlite. No hosted database migration or production deployment has occurred.
