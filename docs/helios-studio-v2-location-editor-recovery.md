# Location editor request recovery

Status: draft implementation, not deployed. Depends on location administration ownership (#303). Production remains held for readiness and Jake's QA/release decision.

## Implemented boundary

Reordering admits one request at a time, including synchronous duplicate clicks. The displayed order changes only after an affirmative success response. Network, JSON, HTTP and negative acknowledgements leave the visible list unchanged and hold further mutations until the operator explicitly reloads saved pages. This does not assert that the server rolled back, and no automatic retry or compensating write is sent. Captured callbacks also respect the held state. Builder/editor opening is blocked while the reorder is pending or held; reorder cannot start while either is already open.

Feature-image uploads use a synchronous admission guard and a per-editor epoch. Successful completion merges only the image key and URL into the current draft, preserving text typed during the request. Closing or switching editors invalidates attachment of a late result. Save is disabled while the upload is outstanding. The old upload is not cancelled or deleted and may leave a registered unused object, which must follow the separate asset-retention policy.

No route, provider, signed-URL protocol, authorization, schema, integration, storage configuration or production data changed in this patch. Image ownership checks remain server-side in the preceding draft. Restoring the prior component requires no migration, but reintroduces these client recovery defects.

## Verification

The executable VM tests transpile the actual manager with synthetic React hooks and fetch. Before implementation they reproduced duplicate reorder admission and stale-closure loss of intervening text. They cover captured callback blocking, unsuccessful acknowledgements, successful reorder, duplicate upload admission and editor closure.

`npm run test:location-browser` bundles the actual React manager and project CSS and runs Chromium against an ephemeral loopback fixture. Only Next Link/Image presentation is stubbed. Fetch is entirely synthetic; unexpected browser destinations or real mutation requests are rejected. Checks cover mobile width, keyboard reload, duplicate admission, success, lost acknowledgement, conflict, invalid JSON, negative acknowledgement, upload/save interaction, preserved text and late completion after switching to a different editor. It does not authenticate, execute the API, exercise real R2 uploads, verify Next image optimization or prove database/browser revision parity. `--bundle-only` checks compilation only and is never browser evidence.

Local browser installation was unavailable due to a download timeout; fresh CI Chromium evidence must be recorded before calling this browser-verified. Local full suite passed 700 tests. Final TypeScript, lint and CI are recorded in the progress ledger.

## Open dependencies

- Browser-submitted revision contracts and authoritative returned order: current server predicates compare a request-time pre-read, not an older open browser draft. Successful reorder acknowledgement does not prove concurrent-browser order agreement.
- Save/create/publish/delete uncertain acknowledgements, idempotency and stale callbacks beyond reorder. No broad recovery claim is made here.
- AI result/context lifetime and complete editor/modal keyboard/focus behavior.
- Requests without a response remain pending; bounded timeout and recovery must not imply rollback or trigger automatic retries.
- Signed-URL lifetime, abandoned object retention, registry retirement/attachment races and verified legacy mapping.
- Authenticated full-stack browser/API/database, real upload/save/reopen, old/new overlap, hosted restore and rollback evidence.

Phase 1 isolation, Phase 2 reliability and all later roadmap exits remain open.
