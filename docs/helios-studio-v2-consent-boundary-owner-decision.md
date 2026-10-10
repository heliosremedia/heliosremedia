# Phase 1 consent boundary: approved non-production architecture
October 4, 2026 live reconfirmation. Packet 36 integrated at `a1a042a28b99730497e9da7188cad4bfd02d9d5f`; Packet 37 candidate `761f43d33cfb0d506d6dadd1d552071c62c66a83` leaves these consent paths unchanged. The synthetic probe was rerun against the current checkout and again reproduced both findings below. No database, live provider or production access. Production ON HOLD.

## Verified problem
Synthetic execution of the actual TypeScript modules, with strictly allowlisted in-memory dependencies and no provider/database connection, reproduced:
- setMarketingPreference for an address represented by separate Company A and Company B clients changed both clients' emailSubscribed value and added both to the global MARKETING_UNSUBSCRIBED group.
- POST /api/admin/clients/preferences accepted an A administrator with a B client ID, returned 200, and reached the preference mutation.

These are executable adapter results, not hosted exploitation claims. No production records or customer data were accessed. Packets 31–37 do not resolve these consent semantics.

Source evidence:
- prisma/schema.prisma: MarketingEmailPreference.normalizedEmail is globally unique; CommunicationSuppression has no workspace identity; CommunicationClient can have multiple CommunicationClientWorkspace memberships.
- lib/client-communications/preferences.ts: preference lookup and client updates/group reconciliation use normalizedEmail without workspace scope. addressIsMarketingEligible checks global preference/suppression.
- app/api/admin/clients/preferences/route.ts: role check followed by client lookup by ID without workspace membership.
- app/api/unsubscribe/route.ts: opaque token selects a global preference and applies a global unsubscribe.
- docs/helios-studio-v2-current-state-audit.md already calls for separate tenant marketing preference and platform safety suppression semantics. The architecture below is now approved; implementation and migration qualification remain incomplete.

## Approved architecture for non-production implementation
1. Company-specific marketing preference keyed by (workspaceId, normalizedEmail), with company-owned history and token provenance. Company administrators may alter only their own marketing preference.
2. Separate platform safety suppression, invisible to other companies and never releasable through ordinary tenant resubscribe. Preserve existing safety blocks and opt-outs during migration. Classify legacy/ambiguous records conservatively as a blocking compatibility overlay until ownership is proven.
3. Public unsubscribe from an attributable company message affects that company's marketing preference. Legacy tokens continue to honor their old opt-out scope; no silent narrowing of an existing opt-out.
4. Complaints and other provider safety events retain their current blocking effect until a separately reviewed provider/sender policy assigns their safety scope. Do not automatically turn old global blocks into tenant-only records.
5. Shared contact identity may remain shared internally, but marketing state and tenant-visible membership/projections must be separate. A caller-scoped query alone is insufficient when the selected client or address is shared.

This changes persisted ownership, uniqueness, legacy token semantics and multiple delivery readers. It is a cross-cutting architecture/migration gate, not a routine webhook fix.

## Bounded implementation sequence after approval
- First contain the unscoped administrator path: current server membership/role, locked authorization, owned client selection, rejection before any global mutation when safe company attribution is unavailable. Do not allow a tenant admin to lift a global safety block.
- Add additive schema and compatibility adapters in a disposable database. No destructive conversion, production migration, provider activation or new customer onboarding.
- Reconcile preferences, history, tokens, client subscription projections, unsubscribe groups, campaign/newsletter/referral send eligibility and webhook writers against one ownership contract.
- Require same-address A/B tests, shared-client A/B tests, foreign client rejection, unsubscribe/resubscribe with global safety block, legacy token behavior, concurrent mutation, rollback and exact-head CI/runtime evidence.
- Retain separate production approval and migration/rollback rehearsal. Phase 1 remains open.

## Owner approval
Jake approved this split consent architecture on October 4, 2026 with “I approve,” including conservative preservation of existing global blocks and legacy opt-outs. This is not approval to deploy, migrate production, send email or onboard customers. If company-level consent is not desired, the alternative is to retain platform-wide preferences, which conflicts with the current independent-company isolation goal and requires an explicit product exception.

## Authority boundary
Jake's standing authorization excludes major architectural and significant product decisions. Jake's explicit October 4 approval clears this architecture gate for non-production implementation. Production release remains separately gated.
