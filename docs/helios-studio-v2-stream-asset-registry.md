# Workspace asset registry: Stream upload foundation

Status: local implementation on the draft V2 stack. No production migration, provider upload or hosted verification.

## Purpose and behavior

Phase 1 needs proof that a supplied video ID belongs to the authenticated company. A URL or a syntactically valid Cloudflare UID does not provide that proof. This introduces the first Phase 2 asset-registry dependency without replacing the Stream adapter.

`WorkspaceAsset` records required workspace ownership, provider/account namespace, provider key, status, byte size, upload expiry and upload provenance. An upload intent is persisted before the existing Tus provisioning request. The route binds the server-received `stream-media-id` header before returning the upload location, and forwards that header to the uploader. Missing identity or a failed database binding withholds the location and marks a still-pending intent failed. No provider object is deleted on an uncertain outcome.

Cloudflare documents the response header as the supported way to get a Tus video ID: [resumable uploads](https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/#get-the-video-id-when-using-tus). The browser prefers that header; its existing URL fallback supports prior resumable sessions but grants no attachment authority.

New Stream media references must resolve to an owned provisioned/ready registry row. The resulting Media row stores the asset ID. A known foreign, failed, quarantined or retired asset is rejected regardless of feature flags. Unknown pre-registry uploads have a temporary fallback only with both tenant and asset-ownership enforcement disabled and exactly one matching workspace. Existing same-project duplicate media remains accessible. Enable `STUDIO_V2_ASSET_OWNERSHIP_ENABLED=true` only after reconciling outstanding legacy uploads. Tenant mode always enforces the registry.

Provisioned means an upload URL was allocated, not that bytes arrived, processing completed or playback succeeded. No code introduced here marks Stream assets ready.

## Migration and rollback

`20260911235500_workspace_asset_registry` creates a new table and nullable Media.assetId. It performs no historical inference or provider calls. Existing application writes can omit the new Media column. Unique provider/account/key identity prevents two companies claiming one resource in the same account. Workspace and linked-asset deletion are restricted. A SQL trigger prevents changes to workspace, provider, account namespace or an already-bound provider key; the Prisma schema alone does not represent that trigger.

Deploy the additive migration through the controlled release process before the new application. Retain the table and references during an application rollback. An older application does not enforce asset ownership, so it is not an acceptable multi-company rollback target. Do not drop registry evidence, recycle bound keys or enable automatic cleanup.

## Verification and remaining gates

Executable helper/handler tests verify owned attachment, foreign/unknown/status rejection, constrained legacy fallback, upload-intent ordering, withholding locations on missing headers or failed binding, one-time binding, and server-owned media linkage. PGlite checks legacy inserts, provider-key uniqueness, owner identity immutability and restricted deletion. These are local tests, not authenticated HTTP/browser or hosted Neon evidence.

Before rollout: rehearse actual Cloudflare headers, resumable reloads, processing and save/reopen; explicitly reconcile legacy provider IDs; test hosted migration/old-new overlap and restoration. R2 adoption, comprehensive usage references, lifecycle/cleanup workers and provider health remain unfinished. Media.assetId is a foreign key, not a database-level proof that every related project has the same owner. Concurrent quarantine/attachment and any ownership-changing parent operations need transaction/relational validation before exposing those lifecycle operations. Existing client-supplied upload metadata handling is unchanged and still requires a reserved-field review. No OAuth/token, public delivery URL or provider-deletion behavior was redesigned.
