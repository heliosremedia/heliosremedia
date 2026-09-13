# Studio settings context and featured-film ownership

Status: draft implementation, September 12, 2026. Phase 1 remains open alongside Phase 2. Production is held for implementation readiness and Jake's QA/release decision.

## Scope and reason

The admin layout and Email AI endpoint resolved settings through the public host rather than the current membership workspace. The Email AI endpoint also relied on proxy role claims instead of its current session role. Executable tests reproduced Company A branding for a Company B member, and a current viewer reaching the synthetic provider with a stale owner token. The endpoints now use `session.workspaceId`; Email AI requires a current editor-or-higher role locally. Public callers still use public-host resolution. Legacy flag-off settings intentionally retain default-row compatibility.

Referral AI now passes the session workspace to settings and filters active services by that workspace. Its existing tenant-mode prohibition and single-workspace containment remain intact. This does not enable multi-company referrals. Both AI endpoints validate object-shaped JSON before context reads and avoid logging or returning arbitrary provider/database errors. Existing model selection, draft/format schemas, provider protocol and Email AI retry limits remain unchanged. No model was called during verification.

The Google review admin read model also allowed the global default row to override a company's review-display policy. An executable isolated regression reproduced `FOUR_AND_FIVE` for a company configured as `FIVE_ONLY`. Tenant-mode reads now select only the session workspace and fail closed on missing settings; legacy fallback stays unchanged. This changes only admin display-policy selection. OAuth configuration inspection, callback/start routes, administrator permission rules, credentials, tokens, import/sync, public review selection and provider adapters are untouched. No Google request occurred.

The adjacent direct-settings audit found a legacy featured-film mutation and presign with no local session check. Replaying the old handlers with synthetic dependencies and no session produced HTTP 200, a settings write and a signed URL. This is an endpoint-local authorization gap, not evidence of anonymous access through a deployed proxy.

## Featured-film contract

- Both endpoints require the current session's editor-or-higher role and resolve an owned settings target. Ambiguous legacy multi-workspace writes fail closed.
- New uploads use `workspaces/<workspaceId>/site-featured-film/` and register immutable R2 identity before signing. Media kind, extension and safe-integer size are validated.
- Saves derive canonical URLs from owned keys and check registry workspace/status before object inspection. Foreign namespaces, mismatched media kinds and newly attached broad legacy keys are rejected. Exact legacy pairs may remain on their already-authorized row.
- Settings persistence rechecks locked account/membership authority after media verification. Existing rows use workspace, ID and modification-time predicates so concurrent changes during verification return 409. This is not a client-loaded revision contract and does not solve all stale-browser edits.
- Replaced objects are retained. There is no cleanup deletion, provider publishing, or storage configuration change. Responses expose only the six featured-film fields, not the full settings row.

## Evidence and limits

`lib/admin-settings-context.test.ts` runs the actual session, membership, settings, layout and AI route code using isolated PGlite delegate adapters, synthetic cookies/token decoding, JSX and provider dependencies. It covers tenant/host disagreement, stale claims, denied membership states, missing settings, input validation, safe failures, bounded retries and referral containment. PGlite queries come from narrow test adapters, not the generated Prisma/Neon client.

`lib/homepage-film-ownership.test.ts` executes the actual mutation/presign, key generation, registry validation, ownership policy and locked-membership helper. Synthetic delegates cover denied/foreign/unregistered/quarantined assets, scoped row creation, exact legacy preservation, revocation before persistence and conditional-write conflicts. These are executable Request/Response checks, not a running Next.js HTTP server or real R2 uploads. Transaction mocks do not establish hosted atomicity, concurrent lock behavior, provider MIME/size inspection, or signed-URL overwrite lifetime guarantees. Existing Chromium CI fixtures remain regression evidence for generation/analytics/publishing recovery, not featured-film or AI browser QA.

## Compatibility and release gates

No schema or production configuration changed. The asset registry migration from the draft stack is still a prerequisite. Existing public URLs and attached legacy files are preserved; newly issued legacy uploads from old application instances must be re-uploaded through the new endpoint. After new namespaced films are saved, the old featured-film writer rejects their prefixes. Do not roll that writer back blindly: retain the scoped writer or temporarily suspend film edits while preserving public reads and stored assets. No deletion or key rewriting is part of rollback.

Before rollout, verify hosted old/new overlap, registry migration, authenticated cross-company HTTP/browser flows, actual upload/save/reopen/playback, role changes, retries and ambiguous commit acknowledgements. Registry state is verified before the settings transaction; coordination with concurrent asset retirement/quarantine remains a shared-registry lifecycle gate. Cleanup requires usage/retention evidence and remains disabled.

## Remaining context audit

1. `app/layout.tsx` still resolves public settings/location data and emits public metadata, structured data and global analytics around Studio routes. The nested admin fix does not remove that root dependency or make an unregistered central Studio host work. Separate public/Studio layout context without trusting client-supplied routing headers, preserving public URLs/SEO and integration behavior, is the next dependency.
2. Google review admin policy selection is isolated in tenant mode by this draft. Full integration inventory, public/admin policy parity in hosted QA and historical review ownership still require verification. OAuth, tokens, review import and provider adapters must remain protected.
3. Tenant-null field defaults, platform brand strings, cache/analytics ownership and the wider settings/model inventory still need work. A call-site search is not a completed integration audit. Phase 1/2 exits and phases 3 through 7 remain open.

Next.js skill and installed data-security/route-handler guidance informed endpoint-local authorization, explicit execution-context arguments and minimal mutation DTOs. No proxy/header-based authorization shortcut was introduced.
