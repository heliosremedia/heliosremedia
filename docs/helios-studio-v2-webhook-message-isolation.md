# Packet 22: signed webhook message identity

September 26, 2026. Production ON HOLD. Parent is Packet 21 merge `59850041da91ca8e8e79a3f496b5c9abd4feed7a`.

## Reproduced defect and correction

The actual Resend handler accepted a signed message ID shared by an email recipient and a referral communication, choosing the email record without checking referrals. With two referral communications it selected the first record. The new executable signed-request tests failed on both cases before the correction; duplicate email matches already failed closed.

The handler now reads at most two matching records from each delivery family. More than one total match is retained as `UNMATCHED_AMBIGUOUS_MESSAGE_ID`, with no workspace/client/recipient attribution, and acknowledged without changing delivery/referral/consent records. Payload recipient addresses and campaign tags cannot select a winner. Unique email and referral matches keep their existing processing paths.

The bounded change does not alter signing policy, timestamp tolerance, provider credentials, global suppression policy or sending. The existing source assertion was updated from referral findFirst to findMany; executable tests prove the semantics.

## Verification

Twenty targeted tests passed, including six new cases exercising the real route and HMAC verification through synthetic database delegates: cross-family/multiple-referral/multiple-email ambiguity for delivered/bounced/complained events; both tenants' unique email/referral matches; duplicate replay; invalid/expired signatures; unknown/missing message IDs. TypeScript, scoped lint and whitespace passed locally.

The existing fixed-loopback Next build/start + PostgreSQL harness is extended with synthetic email/referral records and an explicit synthetic webhook signing key. It sends real signed HTTP requests for all three ambiguity patterns in both tenant directions and asserts unchanged recipient/delivery/referral/client/suppression/preference records. It also verifies invalid signatures cause no writes, unique delivered events process, and duplicates cause no further effects. Prior homepage, portfolio and preview-write race qualification runs first. Exact-head CI and downloaded evidence must pass before runtime qualification is claimed.

## Remaining Phase 1 boundaries

This is not complete webhook isolation or a live Resend/provider qualification. Matching and mutation are not serialized against concurrent provider-message reassignment; duplicate event processing concurrency and partial failure recovery require further work. Existing unique-match attribution still follows the campaign creator's current workspace, and unmatched diagnostics may use campaign tags. Stored campaign ownership must be reconciled separately before multitenant provider activation. Global marketing suppression semantics are deliberately unchanged.

No schema/migration, production setting, credential or live provider change. Existing sender paths remain contained. Evidence distinguishes synthetic signing and local PostgreSQL transport from external-provider and hosted proof.

## Previous packet

PR #328 passed runtime36252096432 and regression36252096449 at `e7743adc25f08b1c08d0a26927250d7b7fbe906a`. Artifact10909416670 downloaded; SHA256 `c8ff0d2e09f8be022fb69412164058b36fdd0df1063a1d3e10c5ce708cccdff7` independently verified. Both tenant POST/DELETE races observed real database blocking, returned403 after membership revocation and preserved preview/audit rows. Schema columns/access postflight passed. Merged only into the non-production development base.
