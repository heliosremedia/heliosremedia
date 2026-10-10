# Packet 40: scoped consent adapters and conservative eligibility

## Behavior

Add an inactive server-side service for company-owned administrator consent. The service owns its transaction, rechecks locked current administrator access, and stabilizes the shared contact and owned membership before selecting the normalized address. Caller-supplied email/workspace fields do not choose the target. Shared contact/client/group state is never updated.

A write changes only the actor company's preference and adds company-owned history plus required audit atomically. Repeated same-status requests are inert. Resubscribe requires explicit confirmation and a recorded source. Foreign clients, demoted actors and malformed inputs fail before consent writes.

The eligibility adapter requires the company's own SUBSCRIBED record. A global legacy SUBSCRIBED value cannot confer another company's permission. Legacy UNSUBSCRIBED/SUPPRESSED or active platform safety suppression always blocks eligibility and administrator resubscribe. Company unsubscribe can be recorded while preserving a protected block; unsubscribe followed by resubscribe cannot lift it. Responses expose a generic protected-block reason, not legacy details or another company's identity.

## Qualification

Thirteen policy/service tests cover precedence, normalized composite lookup, absent scope, input validation and safe output. TypeScript, scoped lint, syntax and source/driver preparation are required before publication.

Disposable PostgreSQL invokes the actual service and Prisma transaction with synthetic actors. It requires concurrent A/B writes on one shared contact, both-direction independent preference/eligibility, foreign-client rejection, current-role enforcement, inert replay and unchanged global/contact projections. Three legacy/safety block forms must deny both tenants and resist an unsubscribe/resubscribe bypass.

A temporary BEFORE INSERT audit trigger admits only fixed synthetic client IDs to a held advisory lock. After observing the actual audit query waiting, cancel only that backend; verify preference/history/audit rollback, unchanged foreign/legacy rows, trigger removal, successful retry and inert replay. Both tenants are tested.

The Node qualification driver replaces only the server-only package's build-time sentinel; the application keeps it intact. This substitution is disclosed in the artifact. Current membership resolution runs with the fixed synthetic tenant flag enabled. No provider calls occur.

## Limits

No application route, public token endpoint or delivery reader is switched to these adapters yet. Public minting/consumption, complete delivery integration and historical consent classification remain subsequent work. Policy intentionally denies unclassified company consent until explicitly supplied; existing single-company compatibility readers remain unchanged. Exact-head CI/runtime and downloaded artifact verification are required before integration. Production ON HOLD.
