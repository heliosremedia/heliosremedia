# Packet 23: stored ownership for webhook attribution

September 26, 2026. Production ON HOLD. Stacked on Packet 22 commit `303e924c413f4371fae6c03bc63759dfb469f941`.

## Reproduced failures

Signed executable tests showed that a campaign's creator moving to another workspace caused email/referral webhook attribution to follow the creator, despite the campaign retaining its original stored workspace. Null-owner campaigns were also accepted in tenant mode, and unmatched payload campaign tags assigned tenant visibility to diagnostic records. All three new tests failed before correction.

## Existing policy applied consistently

The route and permanent-bounce processor now use `resolveCampaignWorkspace(campaign.workspaceId)`, the same policy already used by delivery. Stored identity wins. Historical null ownership is accepted only with tenant context disabled and exactly one workspace; otherwise resolution fails before domain mutation and the event remains FAILED_RETRYABLE with503. No ownership backfill or creator-derived inference is performed.

Unmatched events retain diagnostic email/status but no workspace assignment from tags. Permanent-bounce grouping and audit attribution use the resolved workspace explicitly. Signing, timestamp checks, unique-match processing, global complaint suppression and preference semantics remain unchanged. No provider connection is activated or migrated.

## Verification and limits

Twenty-seven targeted tests passed, including actual signed route execution and the actual ownership policy with synthetic database delegates. Coverage includes creator transfer for both delivery families/tenants, null ownership rejection in multitenant state, preserved legacy singleton behavior, diagnostic-tag non-authority and all Packet 22 ambiguity/signature/replay cases. TypeScript, scoped lint and whitespace passed.

The Next/PostgreSQL harness now temporarily moves the creator while processing unique events, checks permanent-bounce group/audit ownership, rejects unowned campaign events without domain mutations, restores ownership and replays the same failed event successfully. It restores creator workspaces in finally blocks. Prior qualification and postflight remain required. Exact-head CI and downloaded artifact inspection determine runtime qualification, not these preparation notes.

No hosted/CDN/provider parity, concurrent campaign/message reassignment fence, complete webhook concurrency/recovery or consent isolation is claimed. Unmatched records with no workspace no longer appear as tenant-owned diagnostics; platform reconciliation remains a separate operational boundary. There is no new platform access endpoint in this packet. Phase 1 remains open.
