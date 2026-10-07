# Packet 69: Testimonial publishing-status fencing

The testimonial set-status action previously checked session and ownership before a separate status update and response read. It now locks current editor/session authority, recalculates content ownership on the transaction connection, locks the selected row and commits the publishing/featured update with its owned readback. A legacy sole-workspace scope holds a Workspace table share lock while it is evaluated and used. Tenant mode continues to exclude unowned records.

The action retains its editor threshold and existing independent published/featured booleans. It does not change testimonial text, images, row-version semantics, provider reviews, create/update/reorder/delete behavior or attachment policy. Missing/unowned/transferred rows return 404; revoked/demoted/stale-session actors return 403.

Both-company HTTP/PostgreSQL qualification denies foreign, unowned and missing IDs and observes eight database-wait races: access revocation, demotion, session invalidation and record ownership transfer. Requests must leave rows unchanged after the competing mutation. An AFTER UPDATE failure verifies status rollback, followed by successful owned publication/feature changes and reversal. Unrelated content and foreign records remain unchanged. Temporary injection cleanup and schema/index/access postflight remain gates.

Only disposable synthetic content is published in the isolated Next harness. No real content publication, provider request, schema migration, credentials or production action. Other testimonial mutation families and hosted parity remain open. Phase 1 remains open; production ON HOLD.
