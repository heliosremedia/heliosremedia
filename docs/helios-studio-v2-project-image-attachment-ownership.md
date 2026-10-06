# Packet 60 — Project image attachment ownership

The project image attachment route checked a project/service key prefix and R2 object metadata, but did not consume Packet 55's upload registry. A syntactically plausible key alone was therefore accepted as authority to inspect and attach an object.

Attachment now resolves the exact R2 account/bucket/key registration before HeadObject. It requires matching workspace, PROJECT_IMAGE_UPLOAD provenance for the target project, and UPLOAD_PROVISIONED or READY status. Unknown, foreign, pending, failed, quarantined, retired or incompatible registrations fail with a generic 400. New Media rows retain the admitted assetId. Existing service-prefix, object MIME/size checks and duplicate handling remain.

An unregistered key retains the established Stream-style legacy fallback only when tenant context and explicit ownership enforcement are both disabled and exactly one matching workspace exists. A known incompatible registration never takes this fallback. Existing media rows and public URLs are not rewritten. No backfill or broader cross-project asset reuse policy is introduced.

Tests compose the actual registry helper with the actual route, proving denial before provider access or media mutation and preserving the asset link on success. Helper cases cover legacy, namespace, owner, status and provenance boundaries. Actual HTTP/PostgreSQL rehearsal obtains registered upload keys with synthetic signing, exercises both-company denial and successful attachment/retry, and compares foreign media rows. HeadObject alone uses an explicit no-network substitute; no upload URL is followed.

This packet does not complete attachment transaction fencing: access, project/service lifecycle and asset status changes between lookup and media mutation need separate bounded qualification. It does not qualify object delivery, deletion or a hosted provider. No schema/migration, credentials, real object transfer or production action. Phase 1 remains open; production ON HOLD.
