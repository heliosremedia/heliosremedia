# Packet 46: Phase 1 evidence checkpoint after company consent activation

October 6, 2026. This checkpoint updates the Packet 17 inventory without replacing its historical evidence. Phase 0 remains essentially complete; Phase 1 remains open; Phase 2 has partial groundwork; Phases 3–7 remain ahead. This documentation packet does not deploy, migrate a hosted database, call a provider, enable another company or declare a phase exited.

## Evidence levels

The latest disposable-runtime qualification runs the committed Next application against local PostgreSQL, with synthetic sessions and two synthetic workspaces. Its explicit substitutions are PrismaPg transport, offline fonts, a no-network Social AI provider, and removal of the server-only sentinel from the Node driver. These checks exercise actual HTTP and persistence, but do not establish Neon transport, Vercel/CDN behavior, live provider behavior or Helios production parity.

Regression includes composed modules and desktop/mobile Chromium fixtures. Passing a module fixture is not equivalent to authenticated runtime or hosted proof. Packet 16 remains the historical hosted qualification; later schema/application changes are not covered by that earlier hosted receipt. The protected historical admission hashes and gates must remain intact until a separately qualified successor replaces them.

## Current Phase 1 matrix

| Surface | Evidence now present | Remaining qualification |
| --- | --- | --- |
| Admin/public/API | Packets 18–19 actual alternating-host homepage/settings reads and writes, unknown host, stale/revoked sessions; Packets 20–21 portfolio public/preview access and observed authorization races; Packets 43–45 public consent, directory and administrator HTTP | Enumerate remaining route families against the ownership inventory; complete current-head compatibility and hosted evidence. Consent UI action-policy tests are not a new interactive browser proof of the administrator prompt flow |
| Jobs | Existing newsletter scheduler/settlement and social publishing/analytics claim, health and recovery tests; stored campaign ownership and scoped consent eligibility | Persisted overlapping-worker, stale-claim and recovery evidence for each scheduled family; preserve uncertain provider outcomes. No common queue or automatic timeout-to-resend is approved |
| Webhooks | Packets 22–31 signed synthetic HTTP, stored identity, ambiguity rejection, admission/retry races, payload validation, duplicate handling, complaint settlement and bounce audit rollback | Inventory other webhook families. Live sender/provider safety policy remains separate; existing global complaint/suppression effects remain protected |
| Storage | Workspace asset/brand registry tests; owned upload/attachment tests for work cards, newsletter and social images; narrow legacy compatibility | Complete cross-family upload/read/attach/delete mapping and real isolated persistence proofs. Provider migration/parity is not established by registry or mocked storage tests |
| AI | Packets 32–33 composed prompt/source context isolation; Packets 34–37 actual persisted Social AI output, access changes, audit rollback, malformed/provider failures, cross-company request-ID uniqueness | Other AI families require their own executable input/output and settlement evidence. Synthetic provider substitution does not qualify a live model or its retention behavior |
| Cache | Actual alternating-host/read-after-write homepage/settings qualification from Packets 18–19; editor invalidation/failure tests remain | Inventory other cached readers/tags and qualify their tenant keys. Disposable Next runtime is not CDN qualification |
| Analytics | Existing social ownership/claim/health/recovery tests, portfolio analytics core and newsletter owned current/previous campaign aggregation | Company unsubscribe attribution is not yet consumed by newsletter analytics. Complete remaining provider/worker/runtime ownership and recovery evidence |
| Identity/lifecycle/support | Workspace membership, lifecycle, account policy and mutation tests; runtime revoked/demoted/stale-session cases in admitted routes | Explicit support/platform privilege boundary and lifecycle compatibility verdict. A tenant OWNER is not a platform support operator |

The canonical Phase 1 exit still requires Helios compatibility and evidence that a synthetic second tenant cannot reach Helios records. Two synthetic companies and preserved unit fixtures do not alone supply that verdict. Production access is not authorized by this checkpoint.

## Consent reconciliation

The approved October 4 architecture now has additive company preference/history/token tables and compound ownership constraints (39), atomic scoped writers and conservative eligibility (40), company-bound token services (41), delivery readers (42), public company unsubscribe routing (43), directory projections (44), and administrator activation (45). Protected global blocks remain broader than company consent, and existing legacy tokens retain their old scope.

Remaining concrete source boundaries:

- `lib/client-communications/campaign-delivery.ts` and `lib/newsletters/delivery.ts` still issue `createPreferenceToken`; `lib/referrals/launch.ts` still creates legacy tokens. The scoped token service has not replaced outgoing issuance.
- `lib/newsletters/analytics.ts` counts campaign-attributed legacy preference events. Company token transitions have required audit provenance, but the aggregate does not yet consume company attribution.
- Sender/provider configuration and safety events retain existing containment and global safety semantics. No outside-company sending or narrower complaint scope is implied by company preference activation.
- Migration reconciliation must preserve ambiguous legacy preferences, shared contact flags and protected suppressions. Current additive local migration proof is not a hosted migration or production backfill.

## Next bounded implementation

Complete outgoing campaign token selection under the approved consent contract. First reproduce retry behavior through the actual delivery module with a no-network provider adapter. A pending/retried campaign must not silently receive a different token protocol or provider idempotency payload. Existing legacy links retain their existing scope; unsupported or ambiguous legacy retry state must fail closed with reviewable evidence, not generate a replacement link. New company tokens must derive authority from stored campaign/recipient ownership, recheck current consent and retain deterministic retry identity.

Keep newsletter/referral adaptations explicit rather than assuming campaign coverage proves all three families. Do not remove sender containment or change credential configuration to satisfy a test. This implementation can proceed under standing non-production authorization; provider activation, production release and owner-only credential decisions remain separate gates.

After issuance and attribution, reconcile the remaining matrix by actual route/job/storage families. Do not substitute increasing test counts or additional synthetic consent cases for missing Phase 1 categories.

## Historical records

- [Canonical roadmap](helios-studio-v2-roadmap.md)
- [Packet 17 exit reconciliation](helios-studio-v2-phase-exit-reconciliation.md)
- [Progress ledger](helios-studio-v2-progress-ledger.md)
- [Owner-approved consent architecture](helios-studio-v2-consent-boundary-owner-decision.md)
- [Administrator activation](helios-studio-v2-consent-admin-activation.md)

Production remains ON HOLD.
