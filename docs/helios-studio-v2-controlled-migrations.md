# Controlled migration and deployment sequence

## Build behavior

The V2 build script no longer invokes `prisma migrate deploy`. On Vercel production builds it invokes `prisma migrate status` and stops if that command fails. Prisma generation and Next.js build run only after the check succeeds. Preview and local builds retain their existing generation/build steps without a migration command.

Installed Prisma 7.8 CLI code was inspected: database-behind status reports unapplied migrations and exits nonzero. Build-control tests execute the actual script with mocked child processes and verify that failure stops subsequent steps. No production migration status check or build was executed here.

This check is a migration-history gate, not proof of data integrity, schema-drift absence, valid ownership mappings, application compatibility or QA completion. Hosted behavior, permissions and recovery must still be verified. A production build needing migrations will now intentionally fail until the separate reviewed migration operation has completed.

## Required release evidence

1. Finish implementation and review the exact release tree and complete migration set. Do not merge the existing draft stack blindly. Its earlier migrations include required brand ownership and need compatibility review.
2. Complete QA with Jake and record outcomes. Preserve the production hold until that sequence is complete.
3. Confirm backup/PITR coverage and demonstrate restoration in an isolated environment. Record reconciliation queries and counts without publishing customer data or credentials.
4. Rehearse the exact migration set with the old and new application versions, including nullable expansion, verified per-record mappings, pooler/connection behavior, locks, retries and rollback. Never use guessed ownership mappings.
5. Pin the reviewed migration artifact and run the separate migration operation in the approved environment. `prisma migrate deploy` applies all pending migrations in that artifact, not just the latest folder. Stop on unexpected migration history or data discrepancies.
6. Reconcile data and run the history check. Deploy only the verified release tree after the gate passes.
7. Perform production smoke verification and monitor errors, schedules and provider health. Roll back the application only to a schema-compatible version. Do not drop additive data or use destructive resets as rollback.

No bypass flag was introduced. Do not restore automatic mutation to make a build pass. Existing production behavior is unchanged until this draft is merged and deployed through the required release process. The current production build mechanism on main remains an audit risk until the controlled release is made.
