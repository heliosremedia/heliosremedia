# Packet 38: administrator consent containment

Jake approved the split consent architecture on October 4, 2026. The live base is Packet 37 merge `0b13aa489a61a91a87e5a24df725e45ec9aa0f40`. Production ON HOLD.

## Behavior

The prior synthetic probe reproduced an A administrator reaching the global preference writer with B's client ID. The administrator route now selects an owned client after locked current administrator authorization. Foreign clients return 404. Tenant mode, multiple companies, mismatched sole ownership and unattributed same-address client projections return 409 before global mutation. Body-provided workspace values cannot choose authority.

Until company-specific consent storage and all readers are integrated, the global writer is available only through an attributed single-company compatibility path with tenant mode disabled. That short transaction takes table locks on Workspace, CommunicationClient and CommunicationClientWorkspace to serialize global projection changes against provisioning, client edits and ownership-link edits. This is transitional containment, not the eventual multitenant write design. Lock conflicts fail without an automatic retry.

A SUPPRESSED preference or active safety suppression blocks both unsubscribe and resubscribe, avoiding an unsubscribe-to-resubscribe bypass. Preference/history/group changes and required audit now share one transaction. An audit failure rolls back the preference mutation. The compatibility path retains existing confirmed-consent requirements.

## Evidence and limits

Twelve composed route/service tests cover foreign/current-access denial, tenant/multiple-company/ambiguous ownership, both safety forms, single-company compatibility, audit rollback and invalid input. Persistence/current-access are adapters in these tests.

Disposable Next/PostgreSQL qualification requires both-action, both-direction foreign client 404 and owned/shared client 409, unchanged global preferences/safety/client/group/audit rows, and four lock-observed revocation/demotion cases returning 403 after initial session admission. Access restoration and all prior runtime postflight remain required. The runtime does not claim qualification of the legacy success transaction or its table-lock contention; those remain module-level evidence in this packet.

Exact-head CI and downloaded artifact inspection are required before integration. No schema change, hosted migration, live provider call or production deployment occurs. This does not yet fix public unsubscribe, preference delivery readers, shared-client projections or provider safety classification. The approved architecture and subsequent additive packets remain necessary for Phase 1 exit.
