# Featured-film browser revision and acknowledgement recovery

September 17, 2026. Packet 3 only, stacked on #309 at `aeb654ec5d6553a66f8d32a6cfb793da2bee9da8`. Production ON HOLD. No following roadmap packet is authorized by completion.

## Surface and reproduced baseline

`HomepageFilmManager` edits the six featured-film fields: enablement, destination, video key/URL and poster key/URL. Its two upload preparations call `/api/admin/homepage-film/presign`, transfer to a signed R2 URL, then automatically PATCH `/api/admin/homepage-film`. Explicit save uses the same writer. Replacement retains storage. The baseline had no removal UI and no current page import of the component.

Before implementation, actual-component regressions reproduced two saves instead of one and an absent browser revision. The real route executed with synthetic dependencies accepted an already-stale versioned tab with 200 instead of 409. Six pre-existing film ownership tests passed while these three new regressions failed. This is executable component/Request-Response evidence, not hosted authenticated access evidence.

The editor now mounts inside the existing homepage-media admin section, alongside the unchanged #309 form. It receives only its six fields and the same-read authenticated revision already loaded by #309, and is keyed by company. This dependency integration does not change organizer IDs/order, preferences, public layout, playback, URLs or the general settings recovery implementation. Two explicit remove-reference actions detach the video (also disable it) or poster without deleting the stored object.

## Contract

- A single synchronous admission ref covers explicit save, both uploads, replacement and detach. Inputs and captured edit/save handlers are frozen during the operation and during recovery. No accepted pre-save edit is overwritten. Prepared input is copied before asynchronous work.
- `x-helios-film-revision: 1` identifies the new contract. Settings writes submit an operation ID plus the open settings ID, authenticated company, stored owner (including legacy null) and revision. Metadata is compared against server authority, never used to select a company. Existing unversioned callers remain supported.
- The narrow server correction rejects already-stale tabs before media checks and returns transactional authoritative readback for versioned writes. Existing editor authorization, scoped target resolution, locked membership/account revalidation, request-time CAS, monotonic revision and registry/provider preflight remain intact. The six-field settings DTO remains minimal; identity/revision/media proof live in a correlated envelope.
- The browser validates protocol, operation, scope, exact previous revision, same record/company/stored owner, canonical strictly advanced revision, enablement intent, normalized destination and exact media pairs. New pairs require scoped kind-specific keys and registered proof; retained pairs must match the last confirmed pair; absent media requires empty proof. Extra response fields never enter state.
- Presign acknowledgement identifies operation, company, kind, key, canonical public URL and successful registration. Invalid/foreign/unregistered preparations never start transfer. Registry truth remains enforced by the server; browser envelope checks are containment, not an independent registry query or cryptographic attestation.
- Fetch and JSON settlement share a 30-second deadline; presign plus transfer has a ten-minute deadline. Aborts do not prove server/provider cancellation. Unmount cancels the operation; late presign, transfer and JSON callbacks cannot update another instance or initiate its PATCH.
- Confirmed saves advance the revision. Conflict and uncertain outcomes hold the editor, preserve the attempted draft and last confirmed references, and never automatically replay upload/save/remove/replace. Successfully prepared media references remain in the draft if the settings acknowledgement is lost. A failed or timed-out transfer is not falsely treated as verified uploaded media.
- Recovery reuses #309's existing ephemeral mounted-draft collection without changing its implementation. The selectable copy includes featured-film draft/last-confirmed fields and other registered settings drafts. Reload requires copied confirmation; a changed sibling invalidates it. Reload never replays writes. Other tools are explicitly called out for manual preservation.
- No localStorage, IndexedDB or server draft persistence. Browser unload warnings are best-effort. Forced navigation or crashes can lose memory; manual copy/reload is not automated reconciliation.

## Verification

Targeted actual-component tests execute the real editor/hook with a narrow hook harness. They cover synchronous duplicate/stale callback rejection, revision submission/advancement, frozen destination/enablement, save/upload exclusion, thirteen independently malformed acknowledgement cases plus conflict/network/JSON failure, fetch/JSON deadlines, unmount, both upload kinds, late presign/transfer, prepared reference retention, removals, creation and nullable ownership.

Actual-route tests retain #301/#306 ownership/registry/revocation/CAS regressions and add stale browser preconditions, correlated readback, invalid/foreign metadata, creation, empty/legacy media proofs and readback/post-commit invalidation failure containment. These use synthetic delegates. Their failure-after-write assertions do not establish database rollback, generated-Prisma transactions or hosted concurrency.

The fresh Chromium runner bundles the real editor and real shared recovery collection with synthetic fetch/XHR on loopback. At 390px/1440px it exercises revision advancement, 17 held acknowledgement cases, keyboard/selectable copy/reload, fetch/JSON/upload deadlines, both replacement/removal paths, lost acknowledgement reference retention, late presign/transfer/remount, foreign/unregistered upload responses and a real sibling navigation draft. All external network and actual non-GET requests are denied. Browser success must come from execution, not bundling.

The final local combined suite passed **752/752 tests**. CI run and Chromium execution evidence are pending. Local Prisma generation (no migration), non-incremental TypeScript, scoped ESLint and fixture bundling passed. Local Chromium installation failed at its download CDN; fresh CI is required for browser evidence.

## Rollback and remaining gates

No migration, registry lifecycle, provider/OAuth/token change, physical deletion, production data, deployment or merge. Retain #301/#306 scoped writers and registry safeguards on rollback. Legacy clients still work with the new server; new clients hold unversioned server responses. Reverting only the browser restores its known gaps. Removing the new page mount returns the previous admin presentation. Stored/public media remains untouched.

Remaining: authenticated hosted company-to-company upload/save/reopen/playback and cache readback; actual R2 large-file/transfer behavior; generated-Prisma/Neon rollback/concurrency; shared asset retirement/usage coordination; legacy overlap/cutover/restoration; broader Phase 1/2 and later gates. Other settings writers may advance the same row; the browser safely holds that conflict instead of coordinating unrelated writers. Public consumer parity and product readiness are not established by these synthetic checks.

Recommended next packet only: inventory and executable acknowledgement/recovery baseline for homepage project/work-card curation, with a fresh boundary review. Not implemented. Registry cleanup, old-reader/writer retirement, global slug cleanup and white-label productization remain outside Packet 3.
