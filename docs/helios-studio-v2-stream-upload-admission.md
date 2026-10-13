# Packet 58 — Stream upload admission

Stream upload provisioning already registered an intent before contacting the provider and bound the server-returned UID before exposing an upload URL. Its intent creation still relied on an earlier session decision and an unlocked project lookup. Access could change between that decision and registration.

Intent creation now uses the existing locked editor guard with the verified session version, then locks and verifies the owned project before creating the asset in the same transaction. The route returns safe 403 on current-access denial and 404 when the project is no longer available. Provider provisioning remains after commit. Existing UID binding, failure settlement, byte/duration limits, expiry and attachment ownership behavior remain unchanged; previously issued upload grants are not retroactively revoked.

Focused module tests preserve the original binding/collision and attachment cases while asserting session-version propagation, denial before registration/provider work and no returned upload location on failure. The disposable Next/PostgreSQL harness tests both companies with forged host/header selectors, foreign projects, exact owned provenance, current revocation/demotion/session invalidation after observed workspace lock waits, unchanged denied asset rows and preserved editor compatibility. A lexical provider substitute returns synthetic UIDs/locations with no network fallback; no upload URL is followed.

No schema, credentials, hosted provider or production operations. Phase 1 remains open; production ON HOLD.
