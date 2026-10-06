# Packet 49: Company unsubscribe attribution and newsletter aggregates

Newsletter analytics already authorizes its current and previous delivery campaigns, but counts only legacy preference history. Company-token opt-outs therefore disappear from those aggregates.

## Contract

Add nullable campaignId and messageId historical provenance to company preference events, with an index on company/campaign/status. The token consumer copies these values only from its locked stored token in the existing preference/history/audit/last-use transaction. Public selectors cannot supply attribution. Replay creates no duplicate transition. Existing history remains null; no inferred ownership or backfill.

The internal aggregate reader receives only campaigns already authorized by the newsletter reader. Legacy history keeps its existing campaign attribution; company history additionally requires the current workspace. Count distinct normalized addresses per campaign across both protocols, returning only numeric aggregates. An address unsubscribing under both protocols counts once. Company-only, duplicate, foreign, unattributed and subscribed events have explicit coverage. No global preference or suppression semantics change.

## Verification

Module checks retain administrator rejection, owned current/previous delivery selection, and aggregate-only output. Disposable PostgreSQL qualification consumes events created through actual public HTTP, exercises both-direction aggregate reads and verifies read-only snapshots. Public token tests forge campaign/message selectors and assert stored attribution; existing concurrent replay and required-audit rollback checks remain.

The migration rehearsal applies the checked-in additive migration to an existing synthetic company-history row, proves old fields unchanged and new fields null, then compares declared columns, indexes and ownership constraints. Synthetic fixture cleanup targets only the two explicitly created attribution rows. Historical protected hosted admission hashes remain unchanged.

This is not hosted Neon/Vercel migration qualification or live sender qualification. The reader's caller authorization is module-tested; the new PostgreSQL evidence exercises the actual aggregate helper and public consumer, not the full newsletter analytics page. Production remains ON HOLD. Phase 1 remains open. Referral issuance and the remaining Phase 1 matrix are separate work.
