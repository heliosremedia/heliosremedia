# Referral campaign ownership

Status: draft foundation and containment, not multi-company workflow readiness.

ReferralCampaign now has nullable stored workspace ownership with a restrictive foreign key. New campaigns capture the authenticated company. Dashboard and campaign API reads use stored ownership rather than following a creator's account. Draft updates include ownership in their conditional write. New approvals stamp workspace context and compare the campaign row version before creating a revision. Old campaigns and older writers remain valid during expansion; historical ownership is not inferred from creators.

Audience estimates require workspace context and validate all selected/excluded client IDs and selected group IDs. Every mode, including All eligible, filters client workspace membership. Recommendation groups and referral history are scoped. Existing subscription, suppression and eligibility rules are retained.

Public production/test token lookups scope their campaign before returning content. Public duplicate, rate-limit and existing-client matching queries use that company. Preparation checks stored campaign ownership and rejects a mismatched approval snapshot before claiming work or generating tokens. Delivery rejects mismatched campaign relationships, client membership and changed recipient email before consent checks or provider calls. The delivery claim rechecks company, active status, approval, scheduled revision and schedule version.

## Protected workflow boundary

Preparation and delivery remain contained to the sole matching legacy company with tenant mode disabled. Unconfigured or ambiguous execution is skipped without cancelling customer work. Provider adapters, sender verification, preference tokens, suppression rules, renderers, schedules and existing approval contents are not rewritten. No real email or referral publication occurred. Tests exercise the unchanged authorized delivery call through a mock, not a live sender.

## Remaining gates

Full referral isolation is unfinished: lifecycle helper authorization, transaction-time membership checks, recipient/group races, all manual/referral linkage routes, immutable rendered snapshots, test recipient selection, jobs/cron platform visibility and webhook attribution still require review. The admin containment guard must remain until these are converted and verified. Null historical campaigns need explicit mapping; old approvals without a workspace stamp remain eligible only under sole-company legacy containment. Domain-bound link generation, host/expiry races, hosted SQL/browser workflows and complete state-machine parity remain open.

Tests include actual helper/API execution with mocks for audience ownership, server-owned creation, stale approval, foreign public/test links, foreign API targets, skipped foreign delivery, legacy provider calls and foreign approval snapshots. PGlite verifies expansion and stored ownership independent of creator changes. Source contracts that required creator-derived filters were updated to the new ownership scope while retaining their stale-launch and read-only diagnostics assertions.
