# Packet 17: Phase 1/2 exit reconciliation

September 26, 2026. Reviewed tree: Packet 16 merge `e2dedea3e1d7680798ab65ddbe2f6c8ab4b7c8d7`, with the same application/executor files as verified head `77dfe4104ad0756c1c0aedf87f78a3ece666a609`.

This is an evidence and scope packet. It changes documentation only. It does not enable a feature, migrate data, deploy a Preview, call a provider or change a worker. Phase 0 is essentially complete; Phase 1 remains in final qualification; Phase 2 has partial groundwork; Phases 3–7 remain ahead. Neither Phase 1 nor Phase 2 is declared exited.

## Phase 1 evidence matrix

The roadmap requires negative coverage across every surface below. Named tests are review entry points, not a claim that each entire surface is qualified. Some use source assertions or adapted dependencies. Packet 16 hosted evidence is limited to its actual workflow.

| Surface | Existing evidence / source entry point | Remaining exit evidence |
| --- | --- | --- |
| Admin/public/API | Packet 16 both-direction hosted homepage/settings qualification; `lib/homepage-tenant-isolation.test.ts`; `lib/workspace-context-core.test.ts` | Enumerate other route families; map executable negative cases, compatibility behavior, unknown-host and revoked-membership behavior to each family |
| Jobs | `lib/newsletters/scheduler-claims.test.ts`; `lib/social/publishing-claim.test.ts`; `lib/social/analytics-claim.test.ts` | Cross-workspace claim/settlement/recovery coverage for every scheduled family; real database overlapping-worker and stale-claim evidence |
| Webhooks | `lib/client-communications/resend-webhook-core.test.ts` covers event normalization | Normalization alone does not prove ownership: trace verified provider/message identity through tenant selection and mutation; exercise foreign, missing and duplicate identities |
| Storage | `lib/workspace-assets.test.ts`; `lib/workspace-brand-storage.test.ts`; `lib/newsletters/image-ownership.test.ts` | Map upload, attachment, read and deletion paths across all media families, including compatibility paths; no live storage mutation is authorized by this review |
| AI | `lib/ai-image-request-context.test.ts`; `lib/social-generation-ownership.test.ts`; newsletter source-context tests | Separate actor propagation/source assertions from executable cross-tenant prompt/source/output isolation; keep provider calls stubbed |
| Cache | `lib/homepage-curation-write.ts` invalidation; `lib/site-settings-write-access.test.ts` invalidation/failure handling | Audit tenant identity in cached readers and tags; execute alternating-host/read-after-write cases. Invalidation tests alone do not prove cache isolation |
| Analytics | `lib/social/analytics-ownership.test.ts`, `analytics-claim.test.ts`, `analytics-health.test.ts`, `analytics-recovery.test.ts` | Reconcile social coverage with portfolio/newsletter analytics, worker overlap and hosted authorization evidence |

Membership/lifecycle entry points include `lib/workspace-membership-core.test.ts`, `workspace-membership-lifecycle.test.ts`, `workspace-account-policy.test.ts`, and `workspace-account-mutation.test.ts`. Platform/support access is a separate roadmap boundary: a tenant OWNER role is not evidence of platform support authorization. Full exit also requires an explicit compatibility verdict for Helios and a synthetic tenant's inability to reach Helios records. Two synthetic tenants are valuable hosted proof, but do not by themselves constitute that complete compatibility verdict.

## Shared jobs: preserve the existing differences

| Family | Claim / settlement observed in source | Existing operator behavior | Convergence constraint |
| --- | --- | --- | --- |
| Newsletter | `scheduler.ts` uses bounded leases and `FOR UPDATE SKIP LOCKED`; expired claims are eligible only through type/edition predicates. SEND excludes PREPARED/UNCERTAIN delivery attempts. `job-settlement.ts` fences terminal writes and does not retry settlement after an exception | `job-health.ts` exposes bounded health; `generation-recovery.ts` returns an eligible expired background generation to review with version/run checks and audit | A lease expiry is not blanket permission to resend or regenerate. Preserve edition revisions, delivery uncertainty and claim fencing |
| Social publishing | `publishing.ts` conditionally claims due work; `publishing-claim.ts` locks workspace, connection and immutable claim identities before settlement. Job schema has claimedAt/token, but no leaseExpiresAt | `publishing-review.ts` reports local evidence and explicitly returns providerChecked=false, recoveryAllowed=false, automaticRetryAllowed=false | Unconfirmed provider outcome must remain review-only. Do not introduce generic timeout-to-retry behavior |
| Social analytics | `analytics.ts` conditionally claims work and has bounded retry scheduling; `analytics-claim.ts` fences settlement. Job schema has claimedAt/token, but no leaseExpiresAt | `analytics-recovery.ts` allows flag-gated cancellation after fresh administrator review, opaque claim-bound version and 30-minute age. It does not call a provider or queue a retry | Cancellation only fences recording. Preserve fresh authorization, review version and atomic audit |

`analytics-health.ts` already prevents an older health observation from replacing a newer one and preserves the latest successful attempt time. Health chronology must not be listed as wholly missing.

These three persisted job models are not the complete scheduled-work inventory. Routes under `app/api/cron/` also include blog-series, portfolio-analytics, google-reviews, referrals and email-campaigns; social-studio includes additional work. Their ownership, side effects and uncertainty semantics must be traced before describing the system as a unified job platform.

Shared lease/heartbeat policy, common operational projection, complete provider-health aggregation and measured overlap/contention evidence remain unqualified. This review does not authorize replacing the existing workers with a new queue architecture.

## Shared media evidence boundary

`WorkspaceAsset` stores workspace ownership, provider namespace/key, state, size, provenance and upload expiry. `lib/workspace-assets.ts` verifies owned projects before upload intent, binds a server-received Stream ID once, rejects foreign attachments and narrowly fences legacy single-workspace fallback. Its tests cover these contracts and compatibility cases.

That is partial registry groundwork. The reviewed model is not evidence of a complete cross-domain variant/usage/lifecycle system. Reconciliation of project, portfolio, newsletter, blog and social media remains required; live provider migration still needs parity evidence and its separate gate.

## Next bounded implementation packet

Prioritize the Phase 1 cache/request boundary before shared worker mutations:

1. Inventory cached public/settings readers and their tenant input, cache key/tag and invalidation path. Trace actual runtime usage before changing anything.
2. Add or extend an isolated two-tenant executable test through the actual reader/runtime boundary: alternating hosts, same logical resource name, tenant A mutation followed by A/B reads, unknown host, and stale/revoked membership for private reads. Keep source assertions separate from execution evidence.
3. Correct only an observed bounded defect. If the current implementation already passes, retain the test/evidence and record the surface's actual coverage; do not manufacture a refactor.
4. Run targeted tests and exact-head regression CI. Any hosted extension must retain protected admission and independently checked cleanup. No production or provider credentials are needed for the isolated packet.

This scope adds evidence without introducing a common queue, changing schema, loosening recovery gates or deciding Command Center UX. Broader cache architecture or worker replacement would require a separate design decision.

## Packet 17 review checks

- Canonical charter/roadmap and verified-head ledger reread; historical OPEN entries preserved below a current ledger checkpoint.
- Packet 16 run/artifact, independent Vercel/Neon restoration and non-production merge recorded in [qualified evidence](helios-studio-v2-packet16-qualified.md).
- Matrix maps every Phase 1 negative-path category and distinguishes reviewed source, tests and hosted evidence.
- Worker inventory explicitly credits existing recovery/health behavior and preserves provider uncertainty.
- Documentation links and whitespace checked locally. Exact-head CI status belongs on the PR/run claim after publication; this document does not claim a future run passed.

Production remains ON HOLD. No completion percentages or Phase 1/2 exit claims.
