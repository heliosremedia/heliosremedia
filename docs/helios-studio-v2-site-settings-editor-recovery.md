# Site-settings browser revision and acknowledgement recovery

Date: September 17, 2026. Draft stacked on completed #308 (`7845eb09befa21248711252fba20f8b3306e4df3`), which includes #306 through #307. Production remains ON HOLD. This packet ends at review readiness; no next packet is authorized by completion.

## Exact scope

| Component and page | Write scope | Covered entry points |
| --- | --- | --- |
| `SiteSettingsForm`, `/admin/settings` | Full `/api/admin/site-settings` PATCH | Explicit settings and voice-editor saves, primary logo/monogram uploads and removal |
| `SiteSettingsForm`, `/admin/homepage` | Full PATCH | Explicit homepage save, hero video/poster uploads, hero disconnect, Standard/conversion image uploads and removal |
| `HomepageStructureManager`, navigation mode, `/admin/homepage` | `homepage-navigation` PATCH | Labels, destinations, placement, new-tab flags and order |
| `HomepageStructureManager`, structure mode, `/admin/homepage` | `homepage-structure` PATCH | Both reusable card lists, content, publication flags and order |

The featured-film writer hardened alongside #306 uses another endpoint/component and is not included. Favicon/social-image tools, legal editing, review-display integration, curation layout, projects/work cards and other admin writers are unchanged.

## Reproduced baseline and narrow server correction

Before application changes, actual `HomepageStructureManager` component tests reproduced **two requests instead of one** for synchronous repeated save callbacks and **no submitted browser revision**. A separate actual-route regression reproduced **HTTP 200 instead of 409** for a browser revision older than the row before request admission. The server previously fenced only changes after its own pre-read. Logs were retained locally; executable regressions now assert the corrected behavior.

The only server write change is a versioned browser contract on the three existing settings scopes. Versioned requests require an operation ID and canonical identity/workspace/stored-owner/revision metadata. Their open revision must match the scoped pre-read, including legacy nullable ownership or explicitly missing-row creation. The existing fresh locked administrator check, target re-resolution, stored-row CAS, transactional authoritative readback, create-conflict containment and cache invalidation stay in place. Legacy callers without the header keep their compatibility behavior.

Success includes the operation ID, scope, exact previous revision and authoritative new identity/ownership/revision. The browser validates both envelope and settings DTO before reporting saved. Client-provided workspace metadata is only compared with session-derived authority; it never selects a company.

An admin-only loader reads values and their revision together using the existing singleton ownership target. It passes only public settings fields plus revision metadata. Read failures fail closed instead of pairing editable fallback values with an unrelated revision. Public settings readers, defaults and URLs are unchanged. Authenticated pages key editors by workspace so a company change remounts the editor.

## Browser behavior

- One shared settings hook supplies synchronous admission for saves, clears and upload preparations. Captured obsolete callbacks cannot submit or edit old state. Input is frozen while pending or held; no edit accepted before the save is overwritten. The request input is copied before asynchronous work.
- Saving, confirmed success, stale/conflict and uncertain outcome have distinct messages. Successful validation advances the browser revision. Unexpected identity, company, scope, operation, prior/new revision, DTO shape, JSON, legacy protocol or network results hold the editor without retrying.
- Fetch and JSON settlement share a 30-second deadline. Upload preparation has a separate ten-minute bound, then uses the same 30-second settings acknowledgement boundary. Abort does not prove provider/server cancellation. Cancelled or unmounted preparations cannot start the settings PATCH, and late acknowledgements cannot release recovery or mutate a remounted instance.
- Managed upload publication remains automatic after successful preparation, using the frozen settings input and current submitted revision. Attempted removals and prepared media references remain in the retained draft after uncertain acknowledgement, rather than reverting to an older displayed state. No storage deletion or provider adapter changes were made.
- Recovery offers a selectable JSON copy of **all mounted settings-editor drafts on the page**. The copy includes scope and revision for comparison. A newer sibling edit invalidates the copied-confirmation checkbox and prevents a stale reload callback from discarding that edit. Other tools on the same page are explicitly called out for manual preservation. Reload requires confirmation that the copy was preserved and never replays a write.
- Copies exist only in mounted JavaScript memory. There is no localStorage, IndexedDB, server draft storage or automated conflict merge. Browser navigation warnings are a best-effort aid, not durable recovery from crashes or forced navigation.
- Navigation rows retain their editable identity even when a new row temporarily shares a destination with an existing link. Existing placement/order behavior is preserved.

## Verification

Actual-component hook tests cover all four modes: duplicate/stale callbacks, frozen accepted edits, positive authoritative save/revision advancement, fourteen malformed/uncertain outcomes, fetch/JSON timeouts, late results/unmount, legacy nullable ownership, creation, cleared nullable fields and explicit copy/reload admission. Tests also exercise duplicate-destination editing, the ephemeral multi-editor copy collection and same-read admin revision metadata.

Actual-route tests cover all three scopes, versioned stale tabs, identity/owner/protocol validation, legacy writes and creation. Isolated PGlite executes the existing route and lock/CAS SQL through narrow adapters. Added evidence proves a write can commit before cache invalidation returns 500, another company's row remains unchanged, and a subsequent stale caller is rejected. This is not generated Prisma or hosted concurrency evidence.

The dedicated Chromium runner mounts the actual components at 390px and 1440px. It is designed to check save/revision advancement, twelve held responses per mode, selectable retained-copy/keyboard reload, fetch/JSON deadlines, late response after remount, combined homepage draft preservation and all six synthetic upload preparations. External requests and real non-GET requests are denied; upload transfer is a synthetic XHR. Bundle success is not browser evidence. Final CI/test/Chromium results are recorded in the ledger and PR after execution.

## Rollback and remaining gates

Application-only change; no schema, migration, production configuration, protected integration, legal copy or public URL change. Keep #306 server authorization/CAS fences on rollback. Legacy old clients remain supported by the new endpoint; new clients encountering an old unversioned endpoint hold the acknowledgement. Reverting this UI restores the known browser gaps. Do not infer safety from a successful build.

Remaining: authenticated hosted multi-company save/reopen and cache-readback QA, generated-Prisma/Neon concurrency, actual R2/Stream upload and large-file behavior, controlled overlap/restoration/cutover, old-reader/writer retirement and all broader Phase 1/2 and later gates. Recovery is manual copy/reload, not durable drafts or automatic reconciliation. Other settings writers can invalidate a browser revision; this packet contains the conflict rather than coordinating their architecture.

Recommended next packet, not implemented: featured-film browser revision/acknowledgement recovery on its separate settings writer, after an exact boundary review. Registry lifecycle, global slug cleanup, legal cutover, protected integrations and white-label productization remain outside this packet.
