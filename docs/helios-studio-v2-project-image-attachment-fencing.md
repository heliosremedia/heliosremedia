# Packet 61 — Project image attachment transaction fencing

Packet 60 added registry ownership before R2 inspection. Attachment still used the earlier session, project/service and asset reads when persisting media, leaving a race during object inspection.

After object inspection, the image path now starts a transaction and locks current workspace/account/membership authority, the owned project, active service and exact provider asset. It rechecks ownership and usable status on that transaction's connection. A changed service prefix fails closed. Known registrations cannot disappear into legacy fallback. The temporary unregistered sole-workspace fallback holds table share locks to prevent workspace or asset insertion from changing that decision before commit.

Media creation and project-service association now commit together. Current project hero state supplies duplicate responses. Provider object inspection remains outside the transaction. Lost editor/session access returns 403, missing project 404, unavailable service 409 and incompatible asset 400. No general role or asset policy changes are introduced.

Qualification retains the composed actual route/registry tests and adds actual HTTP/PostgreSQL lock-observed races for revocation, viewer demotion, session invalidation, service archival, asset quarantine and ownership change, in both companies. Denials leave media and project-service rows unchanged; restoration is explicit. A temporary disposable-database trigger forces association failure and verifies rollback of the new media row; the trigger/function are removed in finally. The provider remains the no-network HeadObject substitute.

Stream attachment, external-media mutation, general metadata/reorder/delete actions and hosted/provider delivery parity remain separate boundaries. No schema, migration, credentials, real object transfer or production operations. Phase 1 remains open; production ON HOLD.
