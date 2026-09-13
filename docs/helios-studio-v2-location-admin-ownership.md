# Location administration ownership

Status: draft implementation based on #302. Production remains held for readiness and Jake's QA/release decision.

## Changes and compatibility

Location create, edit, publish, reorder, delete, AI and upload-presign handlers require a current OWNER, ADMIN or EDITOR session locally. Anonymous requests retain 401; current viewers receive 403 even if the proxy admitted an older signed owner role. Writes additionally use the existing workspace/account/membership lock order and recheck active membership, session version and editor permissions inside their transaction. Existing pages remain readable according to the current Studio read policy.

Updates, publication and deletion include workspace and the pre-read modification timestamp in the mutation predicate. Reorder reads the owned ordering under the authorized transaction and conditionally updates both records; partial failure rolls back both. Missing ownership/revisions and unique-slug conflicts return a safe reload conflict. Existing draft-first creation, local copy limits, UI review/apply controls, public URLs and AI provider/schema/retry behavior are preserved. Required location ownership, compound workspace/slug uniqueness and restrict-on-delete already exist; no migration is added.

New location uploads use unique `workspaces/<workspace>/locations/` identities and the existing shared asset registry before receiving a signed URL. Attachment validates both key namespace/kind and registry ownership/status, derives the URL from the owned key, and checks uploaded-object existence for new attachments. Creation cannot attach broad legacy keys. Existing correctly scoped legacy company/record keys and older record-only location keys can remain on that exact authorized record; known foreign record/company keys cannot be grandfathered in. Generic unchanged legacy references still require historical mapping review. No production object was inspected or changed.

Publishing checks the current image policy and known registry status; unpublishing remains available for a corrupt image. Public and Studio DTOs withhold image references whose explicit namespace/record identity fails the pure ownership policy without rewriting stored evidence. Studio shows a replacement notice instead of rendering the foreign pointer. These read checks are not live registry verification for every public asset. Updates and page deletion never physically delete the stored object; usage/retention must authorize later cleanup.

## Verification evidence

Before implementation, an executable actual-route test with a synthetic current viewer received 201 from create instead of expected 403. It now passes. Eight new tests execute actual routes, policy, registry helper, locked authorization and the Studio page with synthetic delegates, including negative roles, foreign records/keys, missing or foreign registry identity, quarantined assets, canonical URLs, revoked membership, changed ownership/revision, publication containment and registration before signing.

A separate case in that suite executes the real route and authorization lock SQL through narrow adapters in isolated PGlite transactions. Failure on the second reorder update rolls back the first; successful reorder preserves Company A; ownership changes prevent publication; revocation prevents deletion; an authorized page deletion leaves other records untouched. This proves isolated SQL transaction/predicate behavior, not hosted Prisma/Neon multi-connection races. The prior public layout test now checks a corrupt image pointer is withheld without changing its stored key.

Initial combined local suite passed 697 tests, with non-incremental TypeScript and scoped lint passing. Final local/CI evidence, heads and links are recorded in the progress ledger. Existing Chromium recovery fixtures and actual Next.js anonymous sign-in HTTP/Chromium checks are regression coverage, not a browser test of authenticated location uploads, edits or AI. No real provider, R2 upload, AI generation, invitation, publication or customer mutation was performed.

## Rollback and open gates

This is code-only and uses existing asset registry/schema. Old location writers reject the new upload prefix. During rollback, retain the new writer or suspend location image writes; preserve all newly issued URLs and objects. Reverting write authorization or cleanup restores known risks and is not an acceptable tenant-enabled rollback. Issued signed URLs remain capabilities for their configured lifetime. Provider latency, old/new overlap and expiry/revocation behavior need hosted rehearsal.

Asset registry status verification currently precedes the location transaction. Concurrent quarantine/retirement and attachment, historical generic legacy references, registry usage/backfill and retention remain open gates. Image DTO filtering does not prove every existing registry relationship is consistent. Timestamp predicates protect changes after the server's pre-read, not an older browser tab lacking a submitted revision. Best-effort audit writes remain outside the mutation transaction, and reorder audit/idempotent-create acknowledgement recovery need further work. Creation order probes can race with legacy writers and must be rehearsed alongside compound uniqueness behavior.

Location AI's provider adapter, model fallback, schemas, tokens and review-only semantics were not rebuilt. This patch adds local authorization only to that protected-adjacent path. Full authenticated upload/save/reopen/replace/publish/reorder/delete/AI browser parity, tenant defaults, retention/export, production SEO/visual QA and Phase 1/2 exits remain incomplete. No production merge, deployment or migration is authorized by these results.
