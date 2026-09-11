# Editorial assets and Newsletter audiences

## Images

NewsletterImageAsset now has nullable explicit workspace ownership with restrictive deletion. Legacy records and old writers remain valid during expansion. New shared AI generation resolves verified actor workspace before provider access, uses company storage namespaces and persists ownership. Blog presigns are company-scoped. Blog attachments validate new keys and derive URLs on the server; unchanged legacy images are preserved. AI gallery/save queries are scoped. Social AI attachment uses an owned asset ID and its stored URL, not a submitted URL or model metadata.

The per-record backfill script now includes NewsletterImageAsset and rejects Blog-to-generated-image ownership mismatches. Mapping must be prepared from verified evidence. No hosted backfill or real image generation/upload occurred.

## Newsletter audience and approvals

Recipient resolution now requires the series workspace and intersects every selection mode with CommunicationClientWorkspace membership. Audience estimates, approval and delivery pass stored context. Unsubscribe, invalid-address and suppression checks remain conservative and unchanged. This requires reconciliation of every legitimate recipient's client-workspace membership before rollout; no fallback to all clients is allowed. Missing mappings can intentionally reduce the audience and must be resolved before activation.

New approval recipient snapshots include workspace identity. Delivery validates that the snapshot matches the series workspace before resolving recipients or contacting providers. Legacy snapshots are accepted only in flag-off, unambiguous single-company mode. Tenant-mode legacy approvals must be renewed. Retry eligibility binds both client ID and normalized email so eligibility cannot transfer across records sharing an address.

These are pre-provider authorization/eligibility changes required for isolation. Resend adapters, delivery API contracts, webhook handlers, tokens, provider message IDs and published content were not changed. No live delivery test or message was sent. Provider behavior, concurrency, state transitions and retry reconciliation still require hosted end-to-end regression evidence.

## Remaining gates

The marketing modules remain single-company-only. Global group ownership, preferences and suppression semantics need review; global client identity/profile semantics, Newsletter series/admin pages, source candidate snapshots, campaign ownership, cancellation/approval races, job context and analytics remain incomplete. The asset usage registry and physical cleanup policies are still outstanding. Existing objects were not moved or purged.

Tests cover the real shared generator using mocked providers, real Social attachment route using mocked persistence, actual SQL expansion/backfill, cross-company recipient selections with opt-outs, approval mismatch before delivery dependencies and client/email retry identity. These tests do not establish hosted production readiness.
