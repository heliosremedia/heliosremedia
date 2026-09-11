# Inquiry ownership and administrative boundaries

Status: draft implementation; production unchanged.

Inquiry now has nullable stored workspace ownership with a restrictive foreign key. The public route stores the resolved workspace, scopes services and rate-limit history, and preserves the existing notification implementation. Because that implementation uses global sender, destination and webhook configuration, public submission is contained to the sole matching company with tenant mode disabled. Other contexts receive 503 before storage or delivery. Company-specific notification configuration is a release dependency, not a silently skipped delivery.

Administrative lists, exports and dashboard inquiry activity/counts use stored ownership, with the established sole-company null compatibility rule. Unassigned inquiries no longer disappear merely because there is no assignee workspace. Related service and assignee selections are scoped. Editor permission is required for mutations and export. Workflow changes and notes first update the scoped parent inside the transaction, acquiring its row lock before children are created. Assignment validation runs in that transaction and requires an active same-company account plus active membership in tenant mode.

Referral inquiry links and detail reads now use inquiry ownership. Referral administrative access is temporarily contained to the sole legacy company while ReferralCampaign and its delivery paths still need immutable ownership. This does not claim referral cron or public-token isolation. Those paths remain an explicit next-phase blocker.

The expansion keeps old inserts valid and does not infer ownership from assignees, service choices or account moves. Verified historical mapping and a later contract are still required. Legacy writer overlap, assignment/membership concurrency, hosted browser workflows, exports with real historical data and company-specific notification delivery remain unverified. Existing Resend calls, webhook destinations, templates and booking integrations were not modified or exercised.

Tests execute actual handlers with mocked dependencies for foreign parents, role checks, foreign assignees, notification containment and export query boundaries. PGlite exercises additive migration, old inserts, stable ownership and restricted deletion. These are local checks, not production verification.
