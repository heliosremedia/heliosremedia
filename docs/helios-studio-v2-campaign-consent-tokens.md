# Packet 47: campaign consent token issuance

## Scope

The scheduled campaign worker now selects its unsubscribe token using stored workspace, campaign revision, recipient and address identity. The selector locks and validates the current source and shared client membership. Tenant mode, an existing company preference or an existing company token uses the scoped token service. Only attributable sole-company compatibility with tenant mode off can retain the legacy issuer, now inside the selector's transaction. Newsletter and referral issuers remain separate work.

The company service rechecks ownership and consent in its own transaction after the selector transaction ends. No nested workspace-lock transaction is held. A subscribed, valid, unarchived shared contact is required. An existing legacy token for the campaign, even expired, prevents silently changing protocol. Legacy links retain their original public consumer and scope.

New company token provenance records `CAMPAIGN_RECIPIENT_REVISION_<rowVersion>` in the existing source field. The HMAC remains deterministic for workspace/campaign/recipient/address and is stored only as a hash. Existing company provenance without a matching revision, a changed revision, or a different signing identity for an issued recipient fails closed with a review-required code. No old token is rewritten or revoked. Public consumption continues to use its stored immutable company/preference binding.

This is conservative admission, not a new provider retry engine. A token issued before a crash can require review on the reclaimed campaign revision even if no email was actually sent. Existing legacy retry behavior, uncertain-provider reconciliation, overlapping send workers and per-provider deduplication windows are not fully qualified by this packet. No automated resend or protocol conversion is introduced.

## Reproduced risk and verification

Actual token/provider-core functions show that changing protocol changes payload bytes under the same revision's idempotency key, while changing campaign rowVersion changes that key. The composed actual campaign worker test simulates an uncertain provider failure followed by a reclaimed revision. The new admission refuses a second provider invocation. Removing both persisted binding fences makes that regression detect two invocations; reviewed source is restored afterward. This is a synthetic adapter result, not a live delivery claim.

Eighteen focused tests cover the selector/service composition, deterministic repeat issuance, hash-only storage, protocol conflicts, changed revision/signing identity, missing source/recipient/client/eligibility, legacy compatibility and no company-to-legacy fallback. Existing caller tests retain foreign-member and pre-provider opt-out assertions. TypeScript, scoped lint, syntax and source preparation are local gates.

Disposable PostgreSQL qualification runs the actual selector and token service for A/B with a shared address: foreign/stale source rejection, concurrent issuance, persisted revision provenance, signing-identity rejection, expired legacy-marker rejection, and a source revision changed after observing a workspace-lock wait. Rejected operations must leave token/preference snapshots unchanged. Existing HTTP, consent rollback, schema/index and access-restoration gates remain. Legacy sole-company compatibility remains module-adapter coverage; no new hosted or live-provider proof is claimed.

No schema, credentials, production migrations or deployment policy changes. Sender/provider containment is retained. Production ON HOLD.
