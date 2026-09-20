# Packet 16: authenticated Neon baseline, bootstrap execution blocked

September 20, 2026. **INCOMPLETE. No database mutation or deployment performed.** Base #322, `codex/v2-hosted-access-owner-action`, head `ba964b856614ce9d4279a99fb5e4c83cd0da5c3c`. Main remains `72dab34568cb6885f3e93b5ed9db38edca156835`. Production ON HOLD.

## Authenticated target and empty baseline

The newly available Neon connector returned project `calm-shape-83359560`, name `helios-v2-staging`, organization `org-nameless-shape-94202911`, region `aws-us-west-2`, PostgreSQL major16 and effective project permission ADMIN. Branch discovery returned `br-young-math-arj7l4r3`, name `main`, ready, under that exact project. The owner explicitly authorized this newly created empty staging target; branch name `main` alone is not an environment classification.

Read-only SQL was explicitly addressed to that project, branch and database `helios_v2_staging`. It returned PostgreSQL `16.15 (eb11870)`, zero user relations, no `_prisma_migrations`, zero public relations/functions/types, zero additional non-system schemas, zero additional extensions beyond plpgsql, and zero event triggers. These are fresh authenticated catalog observations, not a synthetic fixture. No application tables exist, so there are no application/customer rows. No production database was queried.

The database is empty and eligible for evaluation of the clean-bootstrap track. A successful full #318 classifier/postflight is NOT claimed. No target-derived catalog was substituted for the independently pinned expected V2 schema.

## Execution blocker

Connector SQL access works, but local direct PostgreSQL access does not: DNS lookup of both the returned pooled endpoint and its direct counterpart fails with `EAI_AGAIN` / temporary failure in name resolution before TCP connection. This is an execution-environment network failure, not a Neon permission or database failure. The connector returned a privileged connection URI, which was retained privately for inspection, never printed, committed or written to the checkout. It was not used to mutate the database. The returned URI was pooled; migrations require independently verified direct endpoint configuration.

Dependency installation succeeded with `npm ci --ignore-scripts`. Actual `prepareArtifact` from #318 was attempted without any target database connection. Prisma's schema-engine acquisition failed resolving `binaries.prisma.sh` with EAI_AGAIN. Thus baseline artifact generation itself did NOT finish. Historical SQL was not replayed through the connector as a substitute. No db push, resolve, checksum change, migration reorder, schema patch or failed migration row was created.

Independent local integrity checks passed for all106 immutable migration files and exact directory membership. Prisma schema checksum is `ede3650c4b65f8704a125672ed32f7b7110a78a83cdacf14744e6419d02a0892`; migration-manifest checksum is `8cb9e5d72af3c2353018a3099d14172794e165a5e54ee11b02e80c46a5e6437a`. These are source checks, NOT target-schema equivalence. The reviewed baseline checksum remains `6eb3e3af3536ec58df86fcdf5739c2b07dc1664263410c06ceed012c6c6e3dbb`; it was not freshly reproduced here.

## Resume procedure, no manual UI improvisation

1. Supply an approved execution environment able to reach the verified Neon DIRECT endpoint on PostgreSQL/TLS and obtain the pinned Prisma7.8 schema engine. Alternatively use a protected, manually dispatched staging-only CI runner with the staging direct URL injected through secure environment secrets. Do not paste credentials into chat, add them to public workflow arguments, or use production credentials.
2. Recheck exact provider project/branch/database identity and empty state immediately before mutation. The observations above are time-bound. Abort if identity or state differs.
3. Implement/review a narrowly scoped staging executor binding these authenticated identities to the #318 immutable artifact and #319 admission/source checks. Existing `databaseUrl`, `requireDatabase`, `prisma`, release preflight and application harness intentionally accept fixed loopback targets only. Leave those protections intact; do not rewrite the connection URL, spoof loopback, or remove their checks to make staging pass. The current hosted build guard stays closed.
4. Generate the baseline plus18 byte-identical V2 migrations. Verify the independently pinned baseline checksum/reference catalogs, then execute actual Prisma deploy of the clean track. No historical data repair replay, automatic resolve or guessed ownership mapping.
5. Verify current-compatible baseline ledger, full expected catalog including SQL-only guards, repeated no-op deployment, synthetic-only two-tenant seed, actual runtime isolation/revision/concurrency and unchanged ledger. Only then build candidate evidence through the reviewed staging gate.
6. Any failure preserves evidence and stops. No automatic destructive reset or migration repair. No backup restore is required for this attempt because no mutation occurred.

## Results and remaining gates

No bootstrap, post-bootstrap fingerprint, synthetic seed, real Neon application isolation, candidate build/release manifest, hosted HTTP/Chromium or rollback result exists yet. No fresh full regression/TypeScript/Prisma generation/CI run is claimed. This documentation-only checkpoint validates whitespace and immutable source checks; previous968-test CI remains inherited #321 evidence, not Packet16 verification.

Vercel `helios-v2-staging` separation and environment bindings are owner-reported. They were not independently retrieved in this run. The known connector visibility/provenance gate remains open. No Vercel project, domain, alias, environment variable or deployment was changed. No provider side effects, production resources or customer data were used.

Packet16 remains OPEN. Next action is to resume THIS packet in an approved network-capable staging runner, including its scoped execution/admission implementation. Do not begin another roadmap packet, hosted cutover or white-label onboarding.
