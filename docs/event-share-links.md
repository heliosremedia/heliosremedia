# Event-level invite links

The scheduled event detail card has **Copy Invite Link**, separate from per-guest resend actions. It creates/reuses a private event capability in a URL fragment; no guest's RSVP credential is reused. Clipboard denial provides a selectable fallback.

Anyone who receives that link can view only the event's public details and submit their own name, email, Yes/No/Maybe and additional guest count. Details are self-reported, not email-verified. The page discloses sharing those details with the host, and does not enroll the person in marketing. The saved response provides a separate personal Manage my RSVP link; it should not be shared.

## Privacy and correctness

- Admin link creation requires OWNER/ADMIN and the selected workspace, active upcoming event.
- Tokens are random 256-bit capabilities, hashed for lookup, encrypted at rest. Link tokens and personal RSVP tokens are separate.
- Public lookup uses an explicit event-details allowlist. No attendee list, existing response, workspace ID, or other guest credential is returned.
- Credential fragments are cleared on page load, retained in memory only, and omitted from analytics, HTTP paths/queries and referrers. Both API responses are private/no-store.
- Normalized email uniqueness prevents duplicate guests. A shared link cannot read or overwrite an existing email invitation; the person must use the original personal invite or contact the host.
- A random client registration credential survives request retries in memory. Lost-response retries replay only that registration; changes cannot overwrite another guest. The UI freezes an uncertain request until retry.
- Event-row locking serializes duplicate submits with cancellation. Closed, paused or past events cannot register guests.
- Additional guest counts follow existing RSVP rules; No means zero additional guests. Shared guests appear in the existing response totals.
- New shared guests have source SHARED_LINK and are excluded from email delivery expansion and final dispatch checks. No CRM contact, subscription, email delivery or provider call is created.
- Abuse bounds: streamed request body limit, input validation, at most 30 new shared registrations per event per minute and 1,000 shared registrations per event. Replays do not consume another registration.

## Database and verification

Additive migration creates EventShareLink and defaults existing EventInvitation.source rows to EMAIL. Production's existing build script runs migrations before the new app is built. No destructive schema/data operation.

Tests use synthetic guests, encryption and mocked providers; no real invites are sent. Event, component, worker, route and privacy tests cover registration, replay, duplicate identities, cancellation, scope, copy fallback, token handling and counts. Live deployment requires approval.
