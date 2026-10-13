# Packet 44 — Company consent in the client directory

## Observed gap

After the delivery reader and public-token work, the directory still displayed global preference metadata and counted eligibility from a shared contact flag. A company unsubscribe could therefore remain absent from its directory status, and a same-address legacy record could expose source/timing metadata to another company.

## Bounded correction

An explicit workspace projection reads company status and the existing conservative eligibility contract in one repeatable-read transaction. The page supplies only clients from its authenticated membership-scoped query. Company preference status/source/effective time are scoped to that workspace. Protected global opt-outs, active safety suppressions and conservative shared-contact blocks produce a generic SUPPRESSED status with no source or timestamp in tenant mode. Legacy global subscriptions do not become displayed company consent. The sole matching workspace with tenant context off and no company preference retains legacy compatibility.

The directory's existing props receive the company projection; its eligible count also requires a valid, unarchived contact outside the owned bounce group. No company preference, global contact flag, history, group or safety state is mutated. Administrator write containment remains unchanged. Token issuance remains separate work.

## Evidence boundary

Nine module tests exercise owned statuses, protected metadata redaction, active safety/contact blocks, both tenant flag states, legacy compatibility and absent scope. Actual PostgreSQL qualification checks the post-public-unsubscribe A/B state and consistent eligibility. Authenticated real HTTP directory responses, using opposite host context, contain only the session company's private client and consent-source markers. A global protected source/timestamp is absent from both responses. Read-only snapshots are unchanged. Existing public-token rollback, schema/index and access postflight continue.

Exact-head CI and independently downloaded artifact verification remain required. No live provider, hosted migration or production deployment. Phase 1 remains open; production ON HOLD.
