# Packet 79: site-settings attachment authority

Status: candidate pending exact-head qualification. Phase 1 OPEN; production ON HOLD.

Eight executable reproductions on the Packet 78 tree accepted registry authority changes after inspection: logo, monogram, favicon, social image, standard image, conversion image, hero video and hero poster. The route already fenced actor/target/revision, but attachment checks preceded the write transaction.

The fix collects the exact eight verification inputs and rechecks them with the existing locked registry verifier inside the settings transaction. Provider calls remain outside the transaction. Navigation and structure scopes have no attachment inputs and preserve their existing behavior. Exact unchanged legacy references, clearing, version counters, response/revision acknowledgements, administrator threshold and retained provider objects remain unchanged.

Local validation: 1,826 tests, TypeScript and scoped lint passed. The eight reproductions failed on the base and pass with the fix. The isolated HTTP/PostgreSQL qualification requires 28 observed waits across both tenants: all eight registry statuses, foreign registry ownership, actor revocation/demotion/session version, settings ownership and concurrent revision. It also verifies all eight saved references, foreign denial, rollback, concurrent single-winner revision saves, acknowledgement, foreign-row/registry containment and legacy/clear compatibility.

Published-head regression/Chromium, runtime, independent artifact download/hash/parse and merge-tree equality remain integration gates. This closes only the enumerated settings attachment boundary if qualified, not hosted object/CDN delivery, other writer families or the whole Phase 1. No schema/provider mutation or production action.
