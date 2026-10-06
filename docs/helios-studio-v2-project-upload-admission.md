# Packet 55 — Project image upload admission

The project-image presign endpoint accepted any signed-in account, although project media creation/update/deletion already require editor access. It checked project/service ownership before signing but did not register the grant or recheck current access. Packet 55 aligns grants with that existing media-write threshold.

Admission locks the current workspace, account and membership using the shared editor guard, then locks and verifies the owned project and optional active, unarchived company service. It generates the existing project-based key on the server and registers an R2 asset with immutable provider namespace/key and project/service/actor provenance. Signing follows the committed registration; successful and failed provisioning are recorded using the pending asset's owned identity. Errors do not expose provider details. Invalid byte sizes fail before admission.

Project key format, response shape, image types, 50 MiB limit, category fallback and five-minute URL expiry remain compatible. Existing project IDs are unique, and ownership comes from the stored project under lock. No object migration, schema change or live provider operation is included. Attachment/read/delete enforcement and hosted bucket policy remain separate boundaries; registration alone does not prove them.

Qualification composes the actual route and current-access guard with strict adapters, including viewer/revoked/inactive/stale-session rejection, foreign project/service denial, registry collision and failed provider settlement. The disposable Next/PostgreSQL runtime observes a workspace lock wait before revoking access, demoting to viewer, invalidating the session, or archiving the selected service in both companies. It verifies no denied asset changes/grants, owned project/service provenance, editor compatibility and proxy anonymous rejection. Signing uses fixed synthetic credentials; no upload URL is followed.

Local environment note: the recovered executor defaults to Australia/Brisbane. The unchanged social-series authorization fixture produced one occurrence instead of two under that timezone; the same test passes with the CI timezone, UTC. This is a separately observed host-timezone dependency in recurrence planning, not an upload regression, and needs bounded follow-up. Upload assertions were not weakened.

Phase 1 remains open. Production ON HOLD.
