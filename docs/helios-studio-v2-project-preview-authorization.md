# Project preview authorization

Status: draft implementation. No deployed preview or production change.

Preview creation and revocation now require editor access and scope the project to the authenticated workspace. Creation locks the scoped project before minting and storing a token. Revocation includes the project ownership predicate in the update. Foreign projects return not found before creating links or audit entries.

Public token validation requires the resolved workspace along with slug and token. It checks expiry and revocation again in the conditional usage update, returning no preview when that update loses a revocation race. A foreign-host request cannot touch another company's preview usage. The existing SHA-256 token hashing, random token format, expiry choices and public content behavior are retained.

New tenant preview links use active PUBLIC_SITE domains assigned to the same workspace. A sole domain or a single primary domain is accepted. Missing or ambiguous domains fail closed before token persistence. The existing global site URL remains available only for the sole matching company with tenant mode disabled. No domains are registered or changed by this work.

Actual handler/helper tests use mocks to verify roles, foreign targets, issuance, revocation, public ownership, revocation races and domain selection. These tests do not verify hosted lock contention or browser preview behavior. Revocation after validation and before the later project read still needs end-to-end race review; this patch does not claim a fully atomic read/render transaction. Membership changes during a waiting request and the broader project/media route audit also remain open.

## Adjacent media authorization findings

The same project-route review found unauthenticated local Stream provisioning and media deletion, plus media POST/PATCH paths that accepted viewers. Added editor checks at each mutation entry and a same-workspace project predicate before Stream provisioning. The Cloudflare request, upload limits, credentials/configuration access and provider adapter remain unchanged. A mocked authorized request verifies the existing Tus response path; no live upload or provider call was made.

Media deletion now scopes both lookup and delete to the session's company. Physical R2/Stream deletion is deferred and reported as cleanup pending, because database ownership alone cannot establish exclusive ownership of a submitted key or provider ID. Provider deletion adapters are untouched. There is no cleanup worker yet; retained objects require the shared asset registry and verified usages before reclamation. This increases retained storage until that workflow exists and does not prove Stream UID attachment ownership or complete media-storage isolation.
