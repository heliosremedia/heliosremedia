# Client portal ownership

Status: draft implementation; no production migration, registration or provider call.

ClientPortal has nullable stored workspace ownership and a restrictive workspace foreign key. Challenges inherit ownership through their portal. The additive migration preserves historical portals, challenge records, global slug uniqueness and old writers. Verified per-record mapping and a later contract are still required.

Administrative reads and mutations require owner/administrator access and use the authenticated workspace. New portals store that owner. Defaults and reorder operations lock the workspace row and scope every read/write; a foreign update target is rejected before clearing any existing default. Public lists, pages and metadata use the resolved public company. Existing external-provider redirect validation remains intact.

Challenge creation, verification, consumption and registration queries include portal ownership. Verification and registration stop before provider access when the company context is unsupported. Public challenge settings use a trusted workspace argument. The global HDPhotoHub/email configuration and admin connection lookup are contained to exactly one matching workspace with tenant mode disabled. Other companies can use their owned external portal links, but cannot use Helios's HDPhotoHub account or sender.

## Protected integration scope

Changes surround the existing calls with authorization, ownership predicates and containment. HDPhotoHub provider adapters, token signing/hashing/claims, cookie format, SSO validation, email adapter, credentials and configured booking destinations are unchanged. This is necessary to stop foreign portal/challenge IDs reaching the shared provider. Tests use mocked provider/email dependencies and synthetic records; no real account, password, email, token or integration setting was exercised.

## Remaining gates

Tenant-specific provider and verified sender configuration, approved domain/callback binding, hosted migration history/backfill, actual legacy login/registration regression, repeated registration/concurrency behavior and browser verification remain open. Global slug uniqueness is retained during expansion. Default serialization is not a hosted contention rehearsal. Full public white-label copy and portal configuration audit coverage still require work. Do not activate a second company against the shared provider configuration.
