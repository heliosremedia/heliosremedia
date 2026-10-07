# Packet 71: Testimonial reference deletion fencing

An actual-handler reproduction against Packet 70 showed that a session whose editor access was revoked still deleted a testimonial. The new denial test fails on that implementation and passes after current locked authority is required.

DELETE now checks current editor/session authority, recalculates content scope on its transaction connection and locks the selected row before its owned lookup and guarded delete. Sole-workspace legacy scope holds a Workspace table share lock while evaluated and used. The existing missing/conflict statuses, cleanup-pending response and image-retention behavior remain. No image or asset registry row is deleted.

Both-company HTTP/PostgreSQL qualification denies foreign, unowned and missing IDs and observes eight access/session/ownership-transfer races with unchanged content and registry snapshots. An AFTER DELETE failure must roll back. Concurrent deletion produces one success and one 404; repetition is inert. Unrelated testimonials and all asset registrations remain unchanged, with cleanup pending for retained image keys. Trigger/function cleanup and schema/index/access postflight remain gates.

Only disposable synthetic data is deleted in qualification. No provider requests, real-content deletion, schema migrations, credentials or production operations. Create/update attachment and hosted compatibility remain separate. Phase 1 remains open; production ON HOLD.
