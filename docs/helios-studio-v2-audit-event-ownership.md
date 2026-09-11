# Stored audit event ownership

Status: draft implementation. No production migration or event rewrite.

AuditEvent now has nullable stored workspace ownership and a restrictive foreign key. Authenticated route writers pass the server session's workspace. Known-account login events and accepted invitations capture the account/invitation context at event creation. Email campaign delivery supplies its already resolved stored campaign context. Direct portfolio-setting and featured-order event writers also stamp the workspace.

The shared audit helper does not infer ownership from an actor, headers or metadata. Omitted context remains null. Existing history and older writers remain valid during expansion. Legacy null events are visible only in the established sole-company compatibility context; tenant mode excludes them. An actor moving companies cannot move an already owned event into the new company's log.

The activity page now requires owner/administrator access and scopes events by stored ownership. Dashboard audit events and audit-backed portfolio settings/order reads use stored scope. The existing portfolio entity-ID filters and ordering/featured limits are preserved.

## Protected integration boundary

Some edited routes include Google OAuth callbacks, review administration, client sync and preference administration. Their only change is adding the server workspace argument to the existing audit call. No OAuth state, tokens, callbacks, provider operations, consent decisions, destinations, response contracts or scheduling behavior changed. This attribution is necessary because actor-derived audit reads can expose another company's historical activity. Local regression tests and TypeScript cover callers; live integration behavior was not exercised.

## Open gates

Historical audit ownership needs verified mapping. Do not backfill using current actor membership. Referral background writers, bounce/webhook audit attribution and actorless platform events remain unclassified until their execution context is converted. Platform administrator visibility and a distinct platform-event policy are still required. The audit helper retains its existing best-effort failure behavior, so this work does not establish guaranteed audit delivery or compliance readiness. Hosted migration, browser access, account-move and restoration rehearsals remain pending.
