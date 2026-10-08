# Phase 1 owner decision: workspace suspension

Status: **PROPOSED — consequential availability/security policy requires owner decision before implementation.** Production ON HOLD. This document authorizes no state change, migration, enrollment, provider call or deployment.

## Decision to approve

For the first non-production workspace lifecycle implementation, use **ACTIVE** and **SUSPENDED**. Suspension is a reversible platform-controlled pause: preserve all data, stop normal workspace access and new outbound work, and continue only narrowly defined opt-out/safety settlement. A tenant OWNER or diagnostic support grant cannot suspend or reactivate a workspace. No archive/delete/billing policy is introduced.

This is a new policy choice, not a routine code approval. The standing authorization reserves consequential product/architecture and security decisions for Jake. Whether a company-wide pause removes its public website, blocks its administrators and halts its jobs is not settled by the existing roadmap or the support-diagnostics approval.

## Source-backed gap

Reviewed against Packet 79 candidate `965449939a171b6ee4831df608621db7e2074c30`, based on verified Packet 78 integration `e9171e698e0fb92b99519d0a5cbcf83de7c7a359`. Packet 79 changes attachment fencing, not these lifecycle sources.

| Source | Existing behavior | Missing boundary |
| --- | --- | --- |
| [Roadmap](helios-studio-v2-roadmap.md), Phase 1 | Explicitly requires workspace lifecycle states | Does not define states, transition authority or suspension semantics |
| [Architecture](helios-studio-v2-architecture.md), control plane | Names provisioning, domain and support controls | Domain suspension is not workspace suspension |
| [Schema](../prisma/schema.prisma), Workspace | Identity/relations with no lifecycle status | No persisted workspace pause or transition revision |
| [Membership resolver](../lib/workspace-memberships.ts) and [core](../lib/workspace-membership-core.ts) | Account active flag and ACTIVE home membership determine access | No workspace-wide status check; user deactivation is a different operation |
| [Public resolver](../lib/public-workspace.ts) | ACTIVE PUBLIC_SITE domain resolves workspace; legacy compatibility path preserved | An active domain cannot express a whole-workspace pause |
| [Write guard](../lib/workspace-write-access.ts) | Locks workspace/account/membership and checks current role/session | Workspace lock does not itself check a lifecycle state |
| [Support verifier](../lib/platform-support/access.ts) | Current operator/OWNER/grant authority, read-only diagnostic scope | Approved diagnostic access grants no lifecycle administration power |
| [Newsletter claims](../lib/newsletters/scheduler.ts) and [social publishing](../lib/social/publishing.ts) | Family-specific discovery/claims and uncertainty controls | A new workspace pause must not become a generic retry or erase provider outcome evidence |
| [Consent policy](../lib/client-communications/workspace-consent-policy.ts) | Protected suppression blocks remain authoritative | Suspension must not disable recipient opt-out or erase safety information |

## Proposed behavior

| Operation | ACTIVE | SUSPENDED |
| --- | --- | --- |
| Tenant Studio/private API | Existing membership/role/session gates | Deny normal workspace access; safe fixed response without content. Keep global sign-in accessible |
| Public website, portfolio and content APIs | Existing domain/ownership rules | Generic unavailable response (503), no tenant content; no redirect to another company |
| Tenant changes, uploads, new AI/provider work | Existing authorization and ownership rules | Deny new admission, even with an existing session or queued request |
| New scheduled work and claims | Existing family policies | No new outbound send/publish/generate/provider operation |
| Already-started provider work | Existing immutable claim/settlement rules | Permit only necessary owned outcome/audit settlement; no new operation or uncertain-outcome retry |
| Unsubscribe and verified safety callbacks | Existing signed token/provider identity validation | Continue bounded opt-out, bounce/complaint suppression and required safety receipts; no resubscribe, customer browsing or unrelated updates |
| Diagnostic support | Existing explicit owner consent and current authority | Deny if target workspace or operator's home workspace is suspended; support grants never override lifecycle |
| Data, domains and credentials | Existing retention/configuration | Preserve; no deletion, domain release, provider credential revocation or billing action |

Reactivation restores eligibility for newly admitted operations. It does **not** automatically send overdue messages, republish, or retry PREPARED/UNCERTAIN work. Each job family must preserve its current claim/revision and explicit recovery rules; ambiguous work remains review-only. Suspension cannot recall a provider action or response already released. Cached/provider-delivered objects require separate measured containment; no promise of instantaneous global erasure is made.

## Transition authority and audit

- Platform-controlled transition authority must be separate from tenant roles and diagnostic support. Begin with **no real enrolled transition operators** and no tenant-facing suspension/reactivation API or UI. Real enrollment and any real workspace transition require a separate owner/security action.
- Non-production qualification uses synthetic transition actors only. The initial implementation must not infer platform authority from a tenant OWNER account or an environment-selected workspace.
- Require target ID, expected lifecycle revision, required reason and attributable actor. Lock the Workspace row, compare current state/revision, write the transition and append its audit atomically. Failed audit or stale revision means no transition.
- Reject redundant/unknown transitions without silently resetting revision. No tenant data or identity backfill beyond the additive ACTIVE default. ACTIVE↔SUSPENDED is the complete first state machine; archive, deletion, provisioning states, billing suspension automation and emergency bypass remain outside scope.

## Bounded first implementation after approval

1. Add the two states and transition revision with existing workspaces defaulting to ACTIVE; no real workspace is suspended. Feature activation remains default-off outside the synthetic harness.
2. Implement the current-state gate and audited transition core with synthetic-only authority fixtures. Qualify normal session/write admission, public workspace resolution and diagnostic support in real HTTP/disposable PostgreSQL, including observed suspend/reactivate races, stale revisions and audit rollback.
3. Keep provider/worker activation off while enumerating and qualifying every family against the approved pause/settlement rules. A shared helper alone cannot establish workspace-wide enforcement. Record partial boundary completion explicitly; do not claim lifecycle closure until all required callers and safety exceptions are covered.
4. Preserve legacy ACTIVE compatibility, unknown-host denial and cross-tenant isolation. Full regression/TypeScript/Chromium, exact-head runtime and independently verified artifact/merge tree remain gates for each bounded packet.
5. No production migration/deployment, real enrollment/transition, destructive data action, billing or external onboarding follows from this decision.

## Current phase assessment

Phase 1 remains OPEN. Packets 77–78 qualify the approved diagnostic support scope and featured-film attachment boundary. Packet 79 requires its own final gates. Other writer families, jobs/AI/analytics, hosted/cache parity and the final Helios/second-company compatibility verdict remain open independently of this policy decision. This proposal does not authorize Phase 2 or manufacture a lifecycle completion claim.
