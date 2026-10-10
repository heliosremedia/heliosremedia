# Packet 64 — External media creation transaction fencing

The external-URL POST branch still used early access/project/service reads and returned duplicates before checking current Stream registry ownership. Direct UID fencing alone did not cover this alternate entry point.

External media creation now locks current editor/session authority, the owned project and active service, then resolves Stream registry authority on the transaction connection when the normalized provider is Stream. It validates the asset before duplicate responses or creation. Project locking serializes concurrent retries; current project hero state and service category supply the response/record. The temporary sole-workspace fallback has the same stable workspace/asset table locks as direct UID creation.

Existing supported external URL parsing, provider classifications, 200 duplicate/201 creation responses and non-Stream null asset links remain. No external link is fetched by attachment. The change does not impose owned-upload rules on intentional YouTube/Vimeo/external links or alter existing media records.

The existing actual-route Stream external creation/replacement test now supplies transactional adapters for creation. HTTP/PostgreSQL qualification reuses the direct-attachment cases through the external Stream URL entry point: both-company lock-observed revocation, demotion, session, service, asset status/owner changes; concurrent retry deduplication; failed-insert containment; and duplicate quarantine denial. Additional both-company YouTube demotion races and concurrent success verify the guard also applies outside the Stream branch and preserves null asset links. All providers are synthetic or unused; no URL is followed.

PATCH replacement, generic metadata/reorder/hero actions and DELETE remain separately scoped. No schema, migration, credential, real provider transfer or production action. Phase 1 remains open; production ON HOLD.
