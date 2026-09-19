# Packet 11: historical migration dependency and ledger reconciliation

Draft isolated implementation. Production ON HOLD. Base #317 at `6c0058c9b870e12f9d4127741e2eab4cbd1b1d32`; no historical migration, Prisma schema, application runtime or deployment config is changed.

## Root cause and immutable history

Main remains pinned to `72dab34568cb6885f3e93b5ed9db38edca156835`. Lexical replay first fails in `20260727190000_social_direct_publishing` at its first ALTER TYPE: `SocialConnectionState` does not exist. That enum and the SocialConnection/SocialVariant tables used later in the same file are created in `20260728010000_add_social_studio_v18`, six hours later by directory timestamp. The intervening social analytics migration also depends on those objects. Moving only the failing statement is not a safe repair.

All 106 migration SQL files are fingerprinted in `scripts/migrations/bootstrap/history-sha256.json`: 88 historical and 18 V2. Artifact preparation refuses changed bytes or unexpected directories. Existing applied checksums and original names remain immutable. Historical files also contain company-specific seed rows and targeted campaign repairs; those data mutations must NOT be replayed into a new environment or represented as executed there.

No deployed database was accessed. Actual Helios ledger checksums, historical manual schema changes, failed/resolve history and reasons the live database reached its state are UNKNOWN. Fixtures are representative ledger states, not evidence of how production was migrated. Production inventory requires a separately authorized read-only export and schema comparison. No assumption of a healthy deployed ledger is made.

## Supported model

Prisma 7.8.0 generates a pinned pre-V2 schema baseline using `migrate diff --from-empty --to-schema`. The artifact also includes seven historical CHECK constraints and the featured-offering partial unique index absent from the Prisma schema language. Their definitions are extracted verbatim from three immutable historical SQL files. Baseline DDL has explicit BEGIN/COMMIT and no historical seed/repair DML.

This is a **separate migration track**: `20260909000000_verified_pre_v2_baseline`, followed by byte-identical copies of all 18 V2 migrations. It is generated into a temporary artifact, never inserted into the canonical historical migration directory. The artifact records its SQL checksum. Historical ledgers keep using the original directory; no original entry is replaced with a baseline entry.

| State | Action |
| --- | --- |
| Empty application schema, no ledger | New baseline track with actual `prisma migrate deploy` |
| Exact supported historical schema, no ledger | Explicit full-schema verification, then actual `migrate resolve --applied` for the ONE baseline, then deploy V2 |
| #317 pinned schema missing SQL-only guards | Stop; validate/add only the historical guards transactionally, verify exact schema again, then baseline |
| Complete matching historical ledger and supported schema | Preserve every historical row, use original migration track for pending V2 |
| Current matching ledger/schema | No-op deploy; no repair |
| Failed, rolled-back, missing, duplicate, unknown, mismatched entry or schema | Manual review; never auto-resolve, reset, rewrite checksums or infer ownership |

Baselining records an equivalent schema baseline, not a false assertion that historical data migrations executed. Existing historical fixtures populate ledger rows explicitly for testing only. The deployed-ledger inspector is read-only and uses a repeatable-read transaction. It checks names, exact checksums, start/finish metadata, incomplete/rolled-back attempts, duplicate success rows and full schema equality. Partial V2 sequences deliberately require review rather than automatic resumption. Ledger timestamps and IDs are not schema semantics, but are retained unchanged on existing-ledger progression.

## Schema and data evidence

Full comparison includes tables/columns/types/nullability/defaults, indexes and validity, primary/unique/check/foreign-key constraints, triggers and enabled state, functions, enums in order, views, sequences, row-security policies, extra schemas/types/extensions and event triggers. Migration bookkeeping is excluded from application-schema equality and checked separately. Missing or altered guards are mismatches.

The #317 raw snapshot path is compared explicitly: the intended difference is exactly seven historical checks and one partial index. The new baseline restores these protections rather than silently omitting them. The current Prisma model is also compared: database-only checks, legal/global/domain guards and identity triggers remain, plus a known PostgreSQL-versus-Prisma truncated testimonial index name. No `db push` is used to erase those differences.

Actual V2 SQL and actual content/brand/legal operator scripts are exercised. The original-ledger fixture also contains legacy records before Prisma deploy. An explicit verified synthetic brand mapping is installed only on that disposable database for the migration connection, then reset; no production environment setting changes. Two synthetic companies receive explicit verified mappings; repeated supported backfills are idempotent. Clean bootstrap has no guessed legacy owner or Helios-specific seed content. Fixture accounts added after foundation receive explicit synthetic active memberships.

## Isolated operator runbook

These are rehearsal-only instructions, NOT production authorization. Mutating helpers accept only fixed loopback disposable database names and synthetic credentials. No env file, provider credentials or remote database is inherited.

1. **Diagnostic:** verify #317/base, immutable manifest, Prisma 7.8 lockfile and the claim. Inspect every historical ledger row and actual schema from a consistent snapshot. Do not infer state from `migrate status` alone.
2. **State-changing, isolated:** provision the disposable PostgreSQL16 service defined in `.github/workflows/v2-migration-bootstrap.yml`. All target databases must be absent. No overwrite/reset is performed.
3. **State-changing, isolated:** run `PACKET11_REHEARSAL=isolated-only node scripts/rehearsal/bootstrap/run.mjs`. It generates the artifact/reference, executes the new-empty/no-ledger/original-ledger paths separately and failure fixtures. Backups and artifacts remain until disposable environment teardown.
4. **Diagnostic:** `node scripts/migrations/bootstrap/diagnose.mjs packet11_clean .packet11-reference.json`. The reference must come from the pinned successful rehearsal, not be derived from the target being judged. Output includes ledger and schema hashes and state; unsafe states exit nonzero. No resolve/repair is included in diagnosis.
5. **Baseline gate:** a no-ledger historical snapshot must equal the trusted historical catalog. Missing known historical guards require explicit transactionally validated DDL first. Invalid existing data stops that operation. Unknown drift, extra objects, or an existing ledger require manual review. Only then is the single new baseline eligible for Prisma resolve. Never resolve each old data migration as if it ran.
6. **Deploy gate:** select the track established by the verified ledger, pin the artifact, quiesce concurrent schema writers and obtain a verified backup. Validate explicit ownership mappings before data-bearing V2 expansion. Recheck schema/ledger immediately before the authorized isolated command. Existing production-like state is not approved merely because its fixture passes.
7. **Failure stop:** checksum mismatch, unknown/failed/rolled-back/missing entry, schema mismatch, partial DDL or mapping failure stops. Preserve failed ledger/logs and dump. Do not call `migrate resolve` automatically. Disposable failures use a new isolated target; real recovery needs independently reviewed evidence and authorization.
8. **Application:** with PACKET10/PACKET11 isolation flags and fixed PACKET9 URL from CI, run `node scripts/rehearsal/application/run.mjs --restored-fixture`, then `node scripts/rehearsal/bootstrap/after.mjs`. A logical copy of the clean bootstrap supplies the app; no schema push/reseed. Assert the real ledger is unchanged after authenticated synthetic reads/writes and Chromium.
9. **Postflight:** retain exact commit, CI, schema/ledger/baseline checksums, backfill ownership evidence and application results. Do not deploy or provision customers from this packet.

## Future hosted deployment mapping

A new database would use the reviewed baseline track, not the broken old empty replay. Existing Helios would be classified against an authorized schema/ledger export and retain its original track if verified. Customer workspaces in the shared platform are not normally separate database bootstraps; tenant provisioning remains outside scope.

The current V2 production build's `prisma migrate status` uses the canonical history and is NOT yet wired for a separate bootstrap track or a full drift gate. No bypass or deployment change is introduced here. Before any future Vercel/Neon release, the selected track and immutable artifact must be bound to the build/status process, backup restoration proved, mappings reviewed, pooled/direct connection behavior verified and Jake's release gate satisfied. A baseline-track database must not be passed to the current canonical deployment command. Stop on any divergence; do not remove guards to make the build pass.

## Verification checkpoint

Local targeted classifier/safety tests and preliminary PGlite catalog/migration/backfill execution passed. Generated Prisma passed. PostgreSQL, final regression, application and CI results are pending publication at this checkpoint; no hosted or production success is claimed.

Remaining Phase1/2 gates include actual deployed-ledger inventory, reviewed drift reconciliation, hosted Neon/PrismaNeon and deployment-track binding, customer-sized ownership coverage, PITR/export/recovery, independent isolation review and broader media/job reliability. Recommended next packet only: read-only deployment-track/preflight integration inventory and executable release-artifact checks, without production access or cutover. Stop after Packet11.

## First PostgreSQL execution

CI35417222873 reproduced the historical failure and passed clean baseline deployment, verified no-ledger resolve and all historical-ledger negative fixtures. Its interruption assertion expected PostgreSQL's injected exception text, but Prisma 7.8 reports an aborted-transaction error while attempting to record failure logs. PostgreSQL logs confirm the injected exception. The assertion now accepts that Prisma diagnostic and still requires an incomplete ledger and absent baseline tables; no failed migration is resolved. A JavaScript optional-argument TypeScript inference issue in the test helper was also corrected. Final verification remains pending.
