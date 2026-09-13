# Legal editor acknowledgement and recovery

Production is ON HOLD. This draft depends on #307 and does not execute its staged migrations or operator cutover scripts.

## User story

A company administrator edits reviewed legal HTML, saves through the existing scoped legal PATCH route, and sees publication confirmed only after a validated acknowledgement. An uncertain write retains both local documents for explicit comparison after reloading. No automatic publication retry occurs.

## Implementation

- A synchronous ref admits one save for the entire editor. Fields and captured callbacks are fenced while pending or held. Old callbacks cannot submit an obsolete document object after acknowledgement.
- Requests carry the open revision and a version header. Versioned requests must include a revision; legacy callers retain the previous server compatibility path. Successful responses identify the revision protocol. The client validates identity, type, shape, publication intent and a strictly advanced canonical revision before accepting only six DTO fields.
- Creation allows a new identity only from the exact unsaved type placeholder and epoch revision. Existing migrated placeholder IDs with real timestamps remain valid.
- A 30-second boundary covers both fetch and JSON settlement. Abort is containment, not proof of server cancellation. Late results cannot release a hold or overwrite retained edits.
- Network/JSON/permission/conflict/malformed/legacy acknowledgement failures enter a held state with fixed safe messaging. Both document snapshots remain selectable in a read-only recovery field. Explicit copy-preserved acknowledgement enables reload; reload never retries the write. Nothing is stored in browser persistence or sent to another service.
- Saved publication badges use confirmed state rather than an unsaved checkbox. Successful sanitization is displayed from the server response. Unrelated document drafts survive a save. Unsaved/pending/held state registers a browser navigation warning; browser restrictions and crashes mean this is not durable draft storage.
- Basic empty-title/size/short-publication validation stays local and editable. Other rejected responses are conservatively held because the client cannot infer commit state from an arbitrary failure.

## Verification and limitations

Actual-component VM tests first reproduced duplicate requests, unsafe retries and unconfirmed success copy. They cover synchronous callback fencing, identity/revision/shape mismatches, creation and legacy IDs, network/fetch/JSON timeouts and late results, local validation, retained drafts and explicit reload admission. Existing actual-route PGlite tests now check protocol signalling and missing/unsupported version validation in addition to prior authorization/SQL rollback evidence.

The dedicated Chromium runner mounts the real editor with synthetic fetch responses on loopback only. It checks duplicate saves, frozen inputs, confirmed publication, new identity, eight held outcomes, keyboard/selectable recovery, no replay, timeout/late success and mobile/desktop overflow. All real external requests and non-GET network requests are denied. This is not authenticated legal API/browser, generated Prisma/Neon or hosted deployment evidence. Local bundle compilation alone is not browser verification; fresh CI must pass the Chromium step.

## Rollback and remaining gates

No schema, legal copy, provider, OAuth, token, public URL or production setting is changed. Reverting the UI restores prior client behavior but also its known save-recovery defects. Keep #307's scoped server authorization/revision checks and staged migration guards. New clients with old servers hold unversioned acknowledgements rather than claiming confirmation.

Remaining: authenticated company-to-company browser/HTTP QA, hosted Prisma concurrency/backup/cutover/old-reader retirement, durable draft/explicit conflict comparison design, navigation integration with other settings forms, all other settings acknowledgement paths, and broader Phase 1/2 and later roadmap gates. Do not interpret these isolated checks as release or commercial readiness.
