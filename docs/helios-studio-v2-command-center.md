# Studio V2 shell and Command Center

Production-intended implementation over existing architecture; default-off. Production ON HOLD.

`/admin/studio` uses current-session membership and workspace authority, then the existing scoped dashboard service. A server-side explicit workspace allowlist plus OWNER/ADMIN role selects the V2 shell throughout existing admin modules. No client header, URL or host selects a private workspace. With the flag off or an empty allowlist, the original shell stays in place and the V2 page denies access. Existing module URLs and mutation contracts remain.

The Command Center displays persisted attention items, upcoming schedules and recent projects with direct links to existing review and editing workflows. Empty, unavailable and nonzero states are distinct. Viewing does not approve, publish, retry, send or call a provider. Snapshot times are explicitly UTC until a workspace display-time preference is introduced; each module retains its authoritative scheduling timezone. This is an initial integrated product capability, not complete live provider health or all-domain parity.

Navigation groups Projects/Media/Clients, Marketing Studio, and management destinations. Mobile uses native disclosure navigation; keyboard skip-to-content, current-page marking, focus visibility and refresh use existing Next patterns. Original dashboard remains linked. The authenticated layout reuses workspace branding. Rollback is the shell flag, with no data/schema change in this capability.

Validation: current role/flag/allowlist and private overview projection tests; existing authenticated branding/revocation tests; TypeScript and scoped lint. Actual components run in Chromium at 390px/1440px with populated, unavailable and empty states, module links, keyboard navigation and refresh. Actual Next/PostgreSQL runtime requires two-company owned project/attention rendering, alternating/concurrent requests, forged host/header/query denial, anonymous/viewer/revoked/suspended denial, restoration and schema/access postflight. Full regression and independent runtime artifact gates remain required before merge.

Local Chromium download failed (invalid archive); CI must supply the browser evidence. No local screenshot or completed browser result is claimed at preparation.
