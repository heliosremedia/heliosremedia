# Social content editing and review authorization

Status: draft implementation. No live post, queue job, provider account, OAuth callback or token was changed.

The shared content editor previously looked up a variant globally and relied on an earlier route check. Crop/alt-text changes bypassed approval revocation, and AI-cover attachment created a generated-asset record separately from updating the variant. Review actions could accept an obsolete content version.

`requireLockedWorkspaceEditor` now supplies a reusable transaction guard, using the workspace/account/membership lock order already used by account mutations. It rechecks the stored company, active access, current role and session version after acquiring locks. Draft creation and review transactions use it; content mutations also lock existing jobs before their variant, validate workspace ownership and compare the read content version.

Copy, media selection, presentation and AI-cover changes now share the guarded content transaction. Foreign media/relation/image IDs fail before attachment. Requested media order is preserved. Changes increment content version, clear approval, invalidate snapshots and cancel unclaimed queued jobs. Claimed, provider-processing or unresolved external publication states block editing. The edit allowlist prevents changing campaign identity or status through content data. Published variants remain immutable.

The route uses the already-authenticated workspace instead of resolving a potentially moved account again. Approval and adjacent review/schedule/manual-publication mutations retain workspace, content-version and state predicates. Transactional review paths recheck actor access. New internal error codes return bounded user-facing messages. Existing foreign AI-image behavior remains 404, and client-supplied cover URLs remain ignored.

## Evidence and remaining gates

509 automated tests pass. Executable authorization/helper/handler tests cover revoked/viewer/moved/expired-session actors, foreign/stale/published/in-flight edits, scoped media relations, approval invalidation, media order, AI-cover ownership and stale approval rejection. The previous AI-image handler test now executes the shared editor too; its foreign-ID and forged-URL assertions remain. One source contract was updated because media ownership checks moved into the editor. TypeScript, focused lint and diff checks pass.

These transaction tests use mocks, not a multi-connection database or browser. They do not prove provider delivery behavior. Existing browser requests do not consistently submit the version they displayed; the current guard rejects changes between the handler read and transaction write, while full stale-editor UX remains open. Repeated no-op saves can conservatively require review again.

Critical next dependencies identified during review: AI text generation still writes variants outside this editor; publishing job creation reads approval before its transaction; the publishing executor does not yet revalidate current approval/snapshot ownership before provider access. Request-changes, archive, retry and scheduling need end-to-end reconciliation with those worker gates. Campaign duplication must validate copied relationships, and remaining direct admin mutations need the transaction guard. Social defaults still contain Helios-specific context. These are release blockers, not completed isolation claims.

The provider adapters, OAuth/token layer and publishing worker were intentionally not modified in this slice. Any follow-on queue validation change needs its own reason and regression evidence before release. No production publishing is authorized as a test.
