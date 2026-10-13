# Packet 65 — Media update-asset transaction fencing

PATCH update-asset used early access/service/media reads and removed collection hero records before updating media in a separate write. A late failure could therefore leave hero state changed even though the requested update failed.

The action now locks current editor/session authority, the owned project, active destination service and target media row. Current media state drives replacement decisions. Changed Stream URLs resolve locked registry authority on the transaction connection; a bounded legacy fallback holds table share locks. Hero removal, ordering calculation, media update and hero readback commit together. Revoked access returns 403, unavailable project/media 404, inactive destination 409 and incompatible replacement asset 400.

Existing exact unchanged external URLs retain their compatibility behavior without retroactive asset registration. Image metadata edits retain their existing asset link. This packet does not introduce a new quarantine policy for unchanged references, alter external provider parsing or change role thresholds.

Qualification uses both-company HTTP/PostgreSQL tests for foreign media/service denial, twelve observed access/service/replacement-asset races, owned replacement plus service move, and unchanged unregistered legacy URLs. A temporary BEFORE UPDATE Media trigger forces failure after hero removal; all media/hero rows must roll back, and the trigger/function are removed in finally. The existing actual-route replacement fixture remains, including exact unchanged URL behavior.

Reorder, explicit hero/social-image actions, DELETE and hosted object delivery remain separate boundaries. No schema migration, credentials, real provider transfer or production action. Phase 1 remains open; production ON HOLD.
