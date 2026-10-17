# Owner decision: future schedules after workspace reactivation

Status: **APPROVED October 8, 2026; implementation in progress.** Jake explicitly approved preservation of unchanged, valid future schedules in the development recovery directive. Production stays ON HOLD; no provider publishing, cron activation, real transition, credential operation or customer onboarding is authorized.

## Approved decision

The approved recovery rule is: **preserve still-future schedules whose existing approvals remain valid; hold overdue work for explicit rescheduling/reapproval; keep PREPARED/UNCERTAIN outcomes review-only.**

A schedule is still-future if its next intended provider action is after the actual reactivation boundary. A job that became due during suspension is overdue. A scheduled item being in the future when the pause began is insufficient if that time passed before reactivation. Existing ownership, approval revision, lease, consent and provider uncertainty checks continue to apply. Reactivation never manufactures a new approval.

Example: a company is paused Monday and reactivated Wednesday. Monday/Tuesday sends do not catch up. An approved Friday send remains scheduled, provided its approval and ownership are still current. An attempted send with an uncertain provider outcome stays in manual review regardless of its date. If the owner instead chooses blanket invalidation, Friday also needs new human approval/scheduling.

| Choice | Company behavior | Tradeoff |
| --- | --- | --- |
| Preserve still-future valid schedules — recommended | Only overdue/uncertain work is held; later valid commitments survive | Least disruption to existing schedules; implementation needs a durable reactivation cutoff and current approval checks |
| Require renewed approval for all pre-pause queued work | Every old send/publish/generate schedule is held after reactivation | Simpler conservative boundary, but cancels automatic execution of future commitments and adds operator review work |

The first choice is recommended because the charter preserves schedules while the already-approved suspension policy specifically prohibits overdue catch-up. The distinction is significant product behavior across newsletter, email, referral, social and AI scheduling. It should not be silently decided by a timestamp predicate, nor should implementation of a new shared worker engine be smuggled into Phase 1.

## Historical reason this decision was requested

The [approved lifecycle policy](helios-studio-v2-workspace-lifecycle-decision.md) establishes ACTIVE/SUSPENDED, no new outbound work during suspension, necessary settlement/safety exceptions, no automatic overdue replay and preservation of existing family-specific claim/recovery rules. It does not explicitly say whether a pre-pause approval for a still-future action remains valid after reactivation. The [charter](helios-studio-v2-charter.md) requires schedule compatibility and family-specific approval semantics. Both choices above satisfy the no-overdue-replay rule but behave differently for a real company's future calendar.

Jake's standing authorization reserves significant product/architecture decisions for owner involvement. This is that decision, not another routine code, CI, staging or merge approval. After the choice, normal bounded non-production implementation and qualification can continue without per-packet approvals.

## Independently reproduced current gap

The [synthetic probe](../scripts/rehearsal/lifecycle-worker-boundary-probe.mjs) compiles and executes the actual newsletter claim function against a fresh in-memory PostgreSQL engine. It does not call a provider, access hosted databases or mutate a real account. [Recorded output](helios-studio-v2-worker-reactivation-probe.json).

At Packet 84's source, the actual scheduler claims a SEND for a SUSPENDED workspace, claims overdue approved work after reactivation, and retains eligibility for an old still-future approved schedule when its due time arrives. Its existing UNCERTAIN guard still blocks the uncertain control. These are claim-level observations; no actual send was executed and this probe is not a successful lifecycle qualification.

Source review also finds newsletter cron notifications after generation/delivery, social publication reservation before the provider call, and family-specific receipt/settlement paths. A blanket ACTIVE guard on all writes would incorrectly block necessary settlement and opt-out; an ACTIVE-only discovery filter would allow overdue replay after reactivation. Current state alone is insufficient to enforce the approved recovery rule.

## Implementation after the decision

1. Persist an authoritative reactivation boundary or equivalent reviewed schedule-admission binding, updated atomically with the existing lifecycle revision/audit. Do not derive it from mutable process memory or an arbitrary worker clock.
2. Add current-state admission under each family's established lock order for discovery, claims and the last pre-provider step. Default-off compatibility remains until all callers qualify.
3. Implement the chosen future/overdue rule without resetting existing attempts, provider idempotency keys, leases, approval revisions or uncertainty evidence. Explicit current-authority rescheduling/reapproval creates the new eligibility; automatic rediscovery must not do so.
4. Keep already-started outcome/audit settlement and verified opt-out/bounce/complaint safety paths narrowly available. Follow-up notifications, fresh provider operations and uncertain retries are new work and do not inherit a settlement exception.
5. Qualify each family with a real disposable database and no-network providers: suspend between discovery/claim/provider admission, pause through a due time, reactivate before/after a future due time, explicit recovery, uncertain outcomes, both tenant directions, rollback and restoration. Preserve all current CI/artifact/merge-tree gates.

No production migration, real operator enrollment or lifecycle activation follows from this decision. Foundation qualification remains OPEN. The October 8 recovery directive separately authorizes concurrent product development; historical phase-order restrictions no longer block safe non-production shell and Command Center work.
