# Location browser revision contract

Draft implementation stacked on #304. Production remains on hold for readiness and Jake's QA/release decision.

## Contract and authorization

The new editor submits `x-helios-location-revision: 1`. PATCH includes the open record's canonical ISO `expectedUpdatedAt`; DELETE sends `x-helios-location-updated-at`. Reorder also submits an ordered array of `{ id, updatedAt }` for its visible list. Missing/malformed revisions fail with 400, stale revisions with 409. The server never derives authorization or workspace from these inputs. Existing current-session, local editor, locked membership and workspace/revision mutation predicates remain required.

Reorder validates the complete snapshot after taking the workspace/account/membership locks. Duplicate IDs, foreign/missing/extra/reordered rows and changed neighbor revisions cannot be accepted. Canonical timestamp validation avoids ambiguous date representations. Input snapshots and tied-position normalization are bounded to 2,000 entries, a technical safety limit rather than a commercial quota. Larger collections need a bounded list-version/order service before enabling this operation.

Accepted updates advance the stored timestamp to at least the previous revision plus one millisecond, even if the clock has not advanced. All new location update/publish/reorder writers use that rule. No schema migration or integer-version backfill is required. Legacy writers that do not honor the rule remain an overlap gate.

The reorder response includes `revisionProtocol: 1` and only owned `{ id, updatedAt, displayOrder }` rows read inside the transaction. Sparse positions swap their stored values rather than array indices. Equal legacy positions are deterministically normalized within the same transaction, with each changed row conditionally updated. Initial admin ordering includes ID as a final tie-breaker. Public URLs/content are unchanged.

## Editor behavior

The editor replaces its order and revision metadata only from a structurally valid protocol response containing exactly the known record identities, with no duplicate or foreign rows. It never treats an older server's bare success response as proof of the new contract.

Save, publish and delete use synchronous request admission guards. Missing, failed or mismatched acknowledgements hold subsequent mutations without replay. Failed/uncertain saves preserve the draft in place. The operator can copy their text, deliberately close the draft and reload saved pages. No reload button is exposed while that unsaved editor remains open. Form controls and editor closure are disabled during a save so new keystrokes cannot be discarded by its eventual success. Confirmed save/reopen uses the returned record revision. Creation acknowledgement/idempotency is not included in this patch.

## Compatibility and rollback gates

This is an additive protocol: requests that omit both protocol and revision retain the previous request-time compare-and-swap behavior. Any supplied revision is validated even without the protocol header. This preserves the known legacy workflow but does **not** establish complete multi-browser protection while old clients remain active.

Retire old browser/server writers before claiming conflict safety. Keep the revision-aware server available to active new browsers during rollback. An old server may ignore a new client's precondition and perform a write before returning its old response; the new UI can hold that uncertain result but cannot retroactively prevent it. Do not claim rollback overlap is verified merely because the payload is additive. No production release or schema change is authorized by this document.

## Evidence and remaining gates

An executable actual-route test reproduced HTTP 200 for a stale submitted revision before implementation. Synthetic route tests cover stale update/publish/delete, strict/malformed protocol, foreign order snapshots, legacy compatibility and monotonic timestamp advancement. Isolated PGlite executes the actual route and membership lock SQL through narrow model adapters, including partial reorder rollback, stale second-client replay, a neighbor change between pre-read and transaction, sparse/tied ordering, precise response DTOs, revoked access and another company's preservation. This is sequential deterministic conflict simulation, not simultaneous hosted Prisma/Neon concurrency.

Actual-component VM tests cover submitted open revisions, duplicate/stale callback denial, retained drafts, server-confirmed order and rejection of old/foreign/duplicate responses. Expanded Chromium fixtures cover request headers/snapshots, six held reorder responses, three held save responses, save/reopen and revisions refreshed by reorder. All fetch responses are synthetic. No real authenticated API, database, storage, AI, campaign or provider call is made by these browser checks. Final local/CI evidence is recorded in the ledger; fixture bundling alone is not browser verification.

Remaining gates: legacy-writer retirement and hosted overlap, truly concurrent Prisma transactions, large-collection normalization cost, audit atomicity, creation idempotency, request timeout/settlement recovery, user-friendly conflict comparison instead of manual copying, complete modal accessibility, registry lifecycle/retirement, signed URL lifetime, historical mapping, backup restoration and end-to-end authenticated QA. Phase 1/2 and later roadmap exits remain open.
