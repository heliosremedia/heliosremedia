# Packet 53 — Brand upload admission

The shared brand upload service registered an owned asset and granted a signed URL (or wrote server-uploaded bytes) using only the route's earlier session decision. Access revoked while a request was waiting could therefore still obtain a grant.

Registration now runs inside a transaction using the existing workspace/account/membership lock order and current session-version, active-account and role checks. Every caller supplies the verified session version. The twelve supported asset families explicitly retain their existing administrator or editor threshold. A denied current-access check produces a safe 403 without registering an asset or invoking the provision callback. Provider work remains outside the database transaction; existing provisioned/failed settlement is retained.

This is admission fencing, not revocation of previously issued capabilities. Existing five-minute signed URLs retain their expiry. No object lifecycle, bucket policy, credentials, schema or production changes are included.

Qualification includes shared-service ordering/failure checks, actual location-handler revocation/demotion/inactive-account tests, and all 16 upload callers. The isolated Next/PostgreSQL harness exercises both companies with forged hosts/body selectors and observes each request waiting on the workspace row lock before revoking membership, lowering its role or changing its session version. Denied requests must leave all asset rows unchanged and return no upload grant. Editor uploads remain allowed while administrator-only uploads reject editors. R2 signing uses fixed synthetic credentials locally; no signed URL is followed and no object request occurs. Hosted R2 policy and transfer behavior remain outside this proof.

Phase 1 remains open. Production ON HOLD.
