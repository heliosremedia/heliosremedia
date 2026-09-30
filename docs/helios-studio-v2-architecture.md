# Helios Studio V2 Architecture

## System shape

V2 remains one deployable application during the migration, with clear internal boundaries:

- **Control plane:** tenant provisioning, plans, domains, entitlements, support access, and platform health
- **Tenant plane:** projects, media, clients, content, campaigns, jobs, analytics, and integrations
- **Public plane:** tenant websites, portfolios, forms, referrals, preferences, and public media
- **Worker plane:** generation, scheduling, publishing, synchronization, webhooks, and recovery

These are authorization boundaries before they become deployment boundaries.

## Tenant context contract

Every entry point must produce a verified context before business logic executes.

```ts
type WorkspaceContext = {
  workspaceId: string;
  source: "session" | "host" | "job" | "webhook" | "platform-support";
  actorId?: string;
  role?: string;
  requestId: string;
};
```

Rules:

- Admin routes resolve workspace from the current database-backed membership.
- Public routes resolve workspace from an active verified domain.
- Jobs resolve workspace from the persisted job record, not current user state.
- Webhooks resolve workspace from verified provider identifiers after signature validation.
- Platform support requires a short-lived grant naming the workspace, operator, reason, and expiration.
- Client-provided workspace IDs are never authoritative.

## Target identity model

- `User`: platform identity and authentication state
- `WorkspaceMembership`: workspace, user, role, status, notification preferences
- `PlatformRole`: separately granted platform administration
- `SupportAccessGrant`: scoped, expiring, reasoned, and audited

The existing `AdminUser` record remains the compatibility source until users and memberships are backfilled and verified.

## Target workspace model

A workspace owns:

- Brand profile and terminology
- Domains and public routing
- Users and invitations
- Projects and media assets
- Clients, groups, inquiries, portals, and preferences
- Website and portfolio content
- Marketing campaigns and revisions
- Integrations and encrypted credentials
- Jobs, incidents, audits, analytics, usage, and entitlements

Deletion should initially be a reversible suspension. Permanent deletion requires export, retention checks, credential revocation, storage cleanup manifest, and an audited delayed purge.

## Domain resolution

Introduce a workspace domain registry with:

- Hostname
- Workspace
- Purpose: public site, admin alias, tracking, or email link
- Status: pending, verifying, active, failed, suspended
- Verification token and timestamps
- Primary designation

Hostnames are normalized and unique platform-wide. Unknown or ambiguous hosts fail closed. Local development uses an explicit configured workspace, never a database-order fallback.

## Data ownership strategy

Classify every model as one of:

1. **Platform-owned**: plans, global feature definitions, platform audit
2. **Workspace root**: direct required `workspaceId`
3. **Workspace child**: ownership enforced through an immutable required parent
4. **Global identity**: user identity or verified provider catalog
5. **Global safety**: carefully limited abuse or delivery suppression data

Workspace roots receive composite unique constraints. Children may also carry `workspaceId` when it materially improves authorization, job safety, query performance, or database-level consistency.

## Migration pattern

Use expand, backfill, verify, constrain, and contract:

1. Add nullable ownership fields and new tables.
2. Backfill Helios ownership in bounded idempotent batches.
3. Verify counts, orphan records, relationships, and unique collisions.
4. Update reads and writes to require resolved workspace context.
5. Add composite indexes and non-null constraints.
6. Keep compatibility reads behind flags.
7. Remove legacy paths only after Helios parity and rollback windows pass.

Never combine a large ownership backfill with removal of legacy columns in one production release.

## Unified media architecture

Target records:

- `Asset`: workspace, storage provider, key, type, MIME type, size, dimensions, duration, checksum, lifecycle state
- `AssetVariant`: thumbnail, poster, responsive image, optimized email image, transcoded video
- `AssetUsage`: consumer type, consumer ID, role, display order, visibility
- `AssetProvenance`: uploader, source, generation details, AI label, original filename

Existing project media and newsletter assets remain readable through adapters while usages are backfilled.

All object keys use an immutable workspace prefix. Public URLs do not determine ownership.

## Unified job contract

The worker plane provides shared mechanics, not one universal domain state machine.

Every job includes:

- Workspace and job type
- Idempotency key unique within workspace
- Immutable input snapshot
- Due time and timezone snapshot
- Status, attempts, lease, heartbeat, and next retry
- Safe error category and bounded message
- Created authority and approval snapshot when applicable
- Related entity and final output reference

Domain services continue enforcing their own approval and terminal-state rules.

## Integration architecture

Each connection is workspace-owned and contains:

- Provider and external account identity
- Encrypted credentials or provider-managed connection reference
- Granted scopes
- Health and expiration state
- Last successful test
- Reauthorization requirements
- Feature entitlements
- Audit history

Working Meta connection and publishing records remain protected. V2 calls their existing service boundary until a separately approved migration proves parity.

## AI boundary

AI receives a server-built workspace-scoped manifest. It never chooses its own database scope.

Store:

- Workspace
- Prompt and policy version
- Source manifest
- Model and provider
- Output snapshot
- Verification state
- Usage and cost
- Human edits and approval

Generated content remains draft until the domain approval contract permits execution.

## Entitlements and usage

Feature flags control technical rollout. Entitlements control what a subscribed workspace may use. They are separate systems.

Meter at minimum:

- Storage and transfer
- Video processing and delivery
- Email volume
- AI tokens and generated assets
- Social publications
- Active users and projects when plan-relevant

Usage events are append-only, workspace-scoped, idempotent, and reconcilable against providers.

## Observability

Correlate every request and job with:

- Request or job ID
- Workspace ID
- Actor ID when applicable
- Domain and route
- Provider operation category
- Sanitized outcome

Secrets, tokens, raw provider credentials, sensitive addresses, and full email bodies must not enter logs.

## Feature flags

Initial V2 flags:

- `STUDIO_V2_SHELL_ENABLED`
- `STUDIO_V2_TENANT_CONTEXT_ENABLED`
- `STUDIO_V2_MEDIA_LIBRARY_ENABLED`
- `STUDIO_V2_UNIFIED_JOBS_ENABLED`
- `STUDIO_V2_MARKETING_ENABLED`
- `STUDIO_V2_PLATFORM_ADMIN_ENABLED`
- `STUDIO_V2_BILLING_ENABLED`

Flags default off in production and may be enabled per workspace where the flag system supports it.

## Deployment rule

V2 migrations are additive and independently reversible until Helios parity is proven. Disabling V2 must not disable the existing public website, manual publishing, working Meta connections, scheduled content, delivery history, or existing admin routes.
