# Work-card upload ownership, Packet 5

## Inventory before behavior changes

Base: #311, `c1aeadac9f1442ea6369b683aa1cd124fbf5e5bd`; main `72dab34568cb6885f3e93b5ed9db38edca156835`. Production remains ON HOLD.

The only browser surface is `HomepageWorkCardManager` on `/admin/homepage`. Image and looping-preview inputs POST `/api/admin/homepage-work-cards/presign` with `{cardId,kind,fileName,fileType,fileSize}`, then XHR PUT the signed URL, then PATCH `/api/admin/homepage-work-cards` with the frozen card fields. The upload response contains `{key,uploadUrl,publicUrl,contentType}`. No registry preparation or correlated upload acknowledgement exists at this baseline. `createHomepageWorkCardKey` generates `site/homepage/work-cards/<card>/<kind>-<timestamp>-<random>.<ext>`.

The presign route checks an editor session and card ownership through Service.workspaceId, including the existing foreign-featured-media quarantine. It does not revalidate the actor under a transaction lock. The final writer uses #311's workspace/account lock and current authorization, list revision and request headers, scoped update and authoritative readback. Its receipt binds workspace, request, previous/current list revision and ordered card IDs. The browser checks returned card fields against submitted fields, but both sides currently trust the submitted image/video URL. The server validates only the card key prefix and changed-object existence. No WorkspaceAsset identity, preparation state or provenance is checked.

Stored identity fields are `imageStorageKey,imageUrl,videoStorageKey,videoUrl`; library video uses `featuredMediaId` and its existing owned/published/visible selector. Ownership follows the card's Service parent. Images and previews remain separate references when switching modes. Uploads automatically attach the captured card; edits during transfer remain local. Remove deletes the card row only; replacement and removal already retain storage objects after #311. Public reads continue consuming stored URL fields with existing service/workspace and featured-media predicates. Curated cards remain dominant over featured-film fallback. No public reader, URL, SEO or presentation change is planned.

Existing recovery synchronously admits one operation, freezes input, fences late callbacks/unmount, bounds fetch/JSON and transfer, retains sibling drafts and prepared key/URL after lost save acknowledgement, blocks automatic retries, and requires retained-copy confirmation before reload. Executable negative controls will distinguish these existing protections from the ownership/canonicalization gaps.

## Reproduced defects and implementation

Before application changes, the actual-component test observed one transfer from a bare unregistered preparation where zero was expected. The actual PATCH route returned 200 and wrote a new legacy-prefix key with a supplied foreign URL instead of rejecting it. These are synthetic executable reproductions, not production exploitation claims.

Preparation now uses the existing curation transaction and current editor revalidation. New keys are `workspaces/<workspace>/homepage-work-cards/<card>/<kind>-<unique>.<ext>`. The existing WorkspaceAsset registry records immutable R2 namespace/key, owner, declared size and work-card/kind/actor provenance before signing. Provisioned status is committed before the response is returned. Signing/transaction failure does not return a usable success response. No schema/provider configuration changes are made.

The bounded work-card resolver checks registry ownership, allowed status, card/kind provenance and canonical server URL inside the attachment transaction. New unregistered references, foreign scopes, cross-card substitution, wrong media kind, pending/quarantined assets and mismatched URLs fail before provider reads or writes. Changed registered objects retain the existing read-only existence check. Exact legacy key/URL pairs can remain only on their already-authorized card; known foreign registry ownership or disallowed status still fails. New legacy attachment is refused. Public URLs and public reading/presentation are unchanged.

The existing curation receipt correlates preparation with request, workspace, scope and unchanged current revision, and attachment with previous/new revision and ordered IDs. A small media receipt adds protocol 1, prepare/attach intent, card/kind, registry asset ID, canonical key (also the media identity), URL and registration/retention/empty state. Browser checks every pair before transfer or saved-state acceptance; the attachment registry ID must match the admitted preparation. File inputs and save share synchronous admission. Prepared identity is included in the ephemeral retained copy before transfer, with unconfirmed transfer state, and remains available after transfer/save uncertainty. Signed URLs are not copied. Successful attachment clears that preparation copy. There is no browser persistence or automatic retry.

Already-contained controls remain: duplicate admission, frozen card input, late presign/transfer/unmount fencing, edit-during-save preservation, revision conflict containment, sibling drafts and explicit copy/reload. Replacement and removal retain old objects; this packet adds no deletion or cleanup. Switching between image/library/preview retains the other media fields. Library media selection policy is unchanged.

## Validation and limits

Actual route tests execute preparation, current authorization, curation wrapper and attachment helper with isolated database/provider delegates. They are not hosted Prisma/Neon contention or real R2 evidence. Actual-component tests exercise canonical negative receipts, wrong asset IDs after transfer, timeout and retained preparation, alongside the existing recovery suite. Chromium uses the real components with synthetic fetch/XHR and local fixture images at 390px and 1440px. Final counts and workflow evidence will be recorded after verification.

No production build, migration, deployment, data change or provider operation is part of validation. Local fixture bundle success is not a browser pass; local Chromium was unavailable. Hosted authenticated browser, real storage byte/header integrity, signed-capability expiry/revocation, registry quarantine racing attachment, parent ownership transfer, registry usages/lifecycle, mixed-version rollout and restoration remain open Phase 1/2 gates. Registry provisioned status proves preparation, not immutable bytes or full media integrity.

## Rollback

Code-only; retain all issued keys/URLs and registry records. Roll back editor and work-card writers together only after overlap rehearsal. Old writers cannot safely accept new scoped keys and previously allowed unregistered attachment; do not restore them for tenant-enabled writes. New browser against old preparation/writer holds for reconciliation rather than accepting missing receipts. Already attached legacy objects remain readable. Issued URLs are bearer capabilities for the existing configured lifetime. Orphaned/replaced object cleanup is explicitly deferred.

Recommended next packet: bounded parent-ownership transfer race inventory and executable baseline for homepage curation. Do not implement it here.
