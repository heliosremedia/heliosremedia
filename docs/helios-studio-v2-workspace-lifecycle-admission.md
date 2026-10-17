# Packet 81: workspace suspension admission

The approved lifecycle foundation is now integrated through PR #389. This packet connects its default-off ACTIVE check to the current session resolver, common locked content/administrator guard, locked account edits/ownership transfer, and diagnostic support. Both lifecycle and tenant-context flags must be enabled; no real feature activation or operator enrollment is performed.

The admission gap is concrete: Packet 80 could persist SUSPENDED, but existing sessions, write guards and support reads did not consult it. The session graph now rejects suspended or missing workspaces on every request. Transactional guards check lifecycle after acquiring the Workspace lock, so a request waiting when suspension commits cannot use its earlier session decision. Support diagnostics lock target and operator home workspaces in sorted order before identity locks and deny either suspended side. Tenant and support roles remain independent from lifecycle transition authority.

The read-only lifecycle state module is separated from the server-only transition core so native authorization tests can load it without the Next build sentinel. Existing role/ownership fixture suites explicitly retain the default-off adapter; composed session/account tests and real HTTP qualification exercise enabled lifecycle behavior.

The retained homepage rollback manifest now pins the changed write guard and its lifecycle/session dependencies. A rollback missing those files fails the unchanged checksum verifier. Historical reader compatibility remains tested; raw historical writers are still rejected.

## Qualification scope

Local composed-session tests cover both directions, missing workspace, suspended denial, same-cookie reactivation and flag-off membership compatibility. PostgreSQL account tests cover suspended edits/ownership transfer and active/legacy behavior. Disposable Next HTTP qualification covers current-session denial, unaffected other tenant, global login, content/account/support admission, and twelve observed database-lock races across content writes, account edits, support target/home reads, grant creation and revocation. Every denied race must preserve business/account/grant rows and must not append a successful support-read audit. Temporary lifecycle operators are removed, grants revoked and both workspaces restored ACTIVE.

Exact-head regression/TypeScript/Chromium, runtime, independent artifact hash/parse and merge-tree verification remain required before integration. Preparation of this document does not claim those gates passed.

## Remaining gaps

This is not workspace-wide lifecycle closure. Public delivery/503 responses, cached or already-delivered objects, worker discovery/claims, provider/AI admissions outside these common guards, safety callback/opt-out exceptions, overdue backlog after reactivation, and other route writers remain unqualified. Existing invitation writers, for example, inherit initial session denial but are not credited with transactional suspension fencing by this packet. No activation follows from partial coverage. Phase 1 remains OPEN; production ON HOLD.
