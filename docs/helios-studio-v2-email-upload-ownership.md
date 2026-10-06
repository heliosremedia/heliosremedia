# Packet 54 — Email Studio upload ownership

Email Studio's direct-upload route generated global `email/campaigns/` keys and signed them without a workspace asset record. New uploads now use `workspaces/<verified-company>/email-campaign/` keys and the shared registered-upload service. The company and actor come from the verified session; submitted company/key selectors cannot choose ownership. This family uses the administrator threshold, including the locked current-access check added in Packet 53.

The response shape, image validation, random filename behavior and five-minute signature expiry remain compatible. Existing stored campaign URLs are unchanged. This packet does not claim campaign attachment validation, object-policy isolation or safe deletion; those remain distinct storage boundaries. No schema change, object transfer, hosted deployment or production operation is included.

Module tests compose the actual route with strict signing/registration adapters, verify the actual key generator, and require the shared service's administrator guard. The actual Next/PostgreSQL harness reuses the observed-lock upload qualification for this family: both companies, forged host/body selectors, revoked membership, administrator demotion and invalidated session version. Denials must leave every asset row unchanged and expose no upload grant. Anonymous requests are rejected by the authentication proxy with 401. Signatures use only fixed synthetic credentials and are never followed.

Phase 1 remains open. Production ON HOLD.
