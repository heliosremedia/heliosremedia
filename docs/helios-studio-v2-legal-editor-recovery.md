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

The dedicated Chromium runner mounts the real editor with synthetic fetch responses on loopback only. At both 390px mobile and 1440px desktop widths it checks duplicate saves, frozen inputs, confirmed publication, new identity, ten held outcomes, keyboard/selectable recovery, no replay, fetch/JSON timeouts and late success after remounting a newer editor. All real external requests and non-GET network requests are denied. This is not authenticated legal API/browser, generated Prisma/Neon or hosted deployment evidence. Local bundle compilation alone is not browser verification; fresh CI must pass the Chromium step.

## September 17 completion review

Recovered the exact remote #308 head `5be21d5c855555fb690f58f9ff7d3ebf6beab9a9` into a fresh detached worktree and reproduced 722 passing tests before changes. Prior run 34737570082 failed its legal Chromium assertion because CSS transforms the badge's rendered text to uppercase. The check now examines the badge's underlying text while retaining the exact semantic assertion; product styling is unchanged.

Corrected negative response fixtures to match the submitted edited title so identity/type/revision rejection cannot pass merely because of an unrelated title mismatch. Added a positive edited-title acknowledgement and next-revision control. Completed the unfinished actual-route PGlite test proving a document/footer transaction can commit before invalidation returns HTTP 500, with the other company preserved and a separate stale caller rejected. This is evidence for held recovery, not a cache-invalidation architecture change.

No application behavior was redesigned during this completion review. In-flight inputs are frozen and captured edit callbacks are ignored; this prevents accepting new edits that a late response could overwrite. Both pre-save drafts remain available after uncertainty. The recovery snapshot must be copied externally before explicit reload; the synthetic fixture does not prove persisted server readback after reload. Final combined validation and fresh CI evidence are recorded in the progress ledger.

## Rollback and remaining gates

No schema, legal copy, provider, OAuth, token, public URL or production setting is changed. Reverting the UI restores prior client behavior but also its known save-recovery defects. Keep #307's scoped server authorization/revision checks and staged migration guards. New clients with old servers hold unversioned acknowledgements rather than claiming confirmation.

Remaining: authenticated company-to-company browser/HTTP QA, hosted Prisma concurrency/backup/cutover/old-reader retirement, durable draft/explicit conflict comparison design, navigation integration with other settings forms, all other settings acknowledgement paths, and broader Phase 1/2 and later roadmap gates. Do not interpret these isolated checks as release or commercial readiness.
