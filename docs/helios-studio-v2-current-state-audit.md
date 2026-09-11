# Helios Studio V2 Current-State Audit

Date: 2026-09-10

Baseline commit: `a657aef`

## Executive finding

The current application is a viable foundation for V2. It already has a `Workspace` model, workspace-scoped projects, users, services, location pages, portfolio analytics, Google Business data, and extensive workspace-aware Social Studio infrastructure.

It is not yet safe for a second production tenant. Ownership is inconsistent across domains, public workspace resolution assumes a single active company, authentication models one user as belonging to exactly one workspace, and several globally unique fields would collide across white-label customers.

The correct strategy is incremental productization, not a rewrite.

## Verified baseline

- Next.js 16.2.10 App Router
- React 19.2.4
- Prisma 7.8 with PostgreSQL and Neon adapter
- Cloudflare R2 and Cloudflare Stream media paths
- Resend email delivery and webhooks
- Vercel cron entry points
- Custom signed-cookie authentication
- Existing workspace-aware Social Studio publishing protection
- Existing project, newsletter, referral, analytics, and operational test coverage

## Test baseline

`npm test` at `a657aef`:

- 362 tests
- 355 passed
- 7 failed

The failures existed before V2 changes:

1. Operational controls fail safely and expose no diagnostics
2. Project agents use ordered snapshots and optional stable client identity
3. Visible version links to the matching code-controlled release
4. V1.9.2 surfaces retain the frozen public boundaries
5. Social metadata uses configured domain, revisioned default image, and page precedence
6. V1.9.4.1 release is LIVE with accurate notes
7. Email Studio uses sticky preview and provider-confirmed delivery language

These failures must be classified as stale contract tests or real regressions before a V2 code migration begins. V2 may not conceal them by weakening assertions.

The initial type-check also exposed test files using the ES2018 dot-all regular-expression flag while TypeScript targeted ES2017. The V2 foundation raises the compile target to ES2018, which matches the syntax already committed and remains below the runtime capabilities required by Next.js 16. No application behavior changes with this correction.

## Existing strengths

### Workspace-aware foundations

Direct `workspaceId` ownership already exists on important roots including:

- `Project`
- `ProjectAgent`
- `ProjectContributor`
- `AdminUser`
- `Service`
- `LocationPage`
- `VideoOffering`
- `VideoComparisonPlacement`
- `PhotoComparisonPage`
- `PortfolioAnalyticsEvent`
- `SocialCampaign`
- `SocialSeries`
- `SocialConnection`
- `SocialOAuthSession`
- Social autopilot roots
- Google Business connection and reviews
- Client sync runs
- Admin invitations

### Protected publishing behavior

Social Studio documents and tests a known-good Meta path with encrypted credentials, immutable publishing snapshots, approval enforcement, destination isolation, idempotent jobs, and provider attempt records. V2 should reuse that contract.

Newsletter and referral workflows already include state machines, revisions, approvals, idempotency keys, leases, and delivery records. These are valuable patterns even though ownership must become explicit.

### Existing operational concepts

The system already contains audit events, operational incidents, health endpoints, dashboard attention states, scheduled jobs, retry concepts, and provider delivery events. V2 should consolidate these rather than create parallel systems.

## Tenant-readiness gaps

### 1. Public workspace resolution is single-tenant

`getPublicWorkspaceId()` selects the most recently updated `SiteSettings` record with a workspace, then falls back to the oldest workspace. A white-label platform must resolve workspace from a verified host or custom domain. Ambiguous or unknown hosts must fail closed.

### 2. Authentication conflates identity and membership

`AdminUser` contains one required `workspaceId`. This prevents one identity from safely belonging to multiple companies and makes platform support roles difficult.

V2 needs separate concepts:

- User identity
- Workspace membership
- Workspace role
- Platform role
- Time-limited support access grant

The existing login remains operational until the new model is proven.

### 3. Important roots lack direct ownership

Several business roots are global or owned only indirectly through a creator. Examples include:

- `TeamMember`
- `BlogPost` and `BlogSeries`
- `FaqCategory` and `Faq`
- `Testimonial`
- `TrustedLogo`
- `AboutPageContent`
- `LegalDocument`
- `CallToAction` and `CtaPlacement`
- `ClientPortal`
- `EmailCampaign`
- `NewsletterSeries`
- `NewsletterImageAsset`
- `ReferralCampaign`
- `CommunicationGroup`
- `CommunicationSuppression`
- `MarketingEmailPreference`
- `Inquiry`
- `OperationalIncident`
- `AuditEvent`

Creator-based scoping is not a durable tenant boundary. Scheduled jobs and historical records must retain ownership if a creator is deactivated or removed.

### 4. Global uniqueness will collide

Examples requiring tenant-aware decisions include:

- `Project.slug`
- `BlogPost.slug`
- `AdminUser.email`
- `CommunicationClient.hdPhotoHubUserId`
- `CommunicationGroup.normalizedName`
- `CommunicationGroup.systemKey`
- `MarketingEmailPreference.normalizedEmail`
- `CtaPlacement.slot`
- Several storage keys and provider identifiers

Most content uniqueness should become composite with `workspaceId`. User email should remain globally unique only if identity is intentionally platform-wide. Consent requires separate tenant marketing preference and platform safety suppression semantics.

### 5. Media ownership is indirect

`Media` belongs to `Project`, while other domains maintain separate image fields and asset models. V2 needs an authoritative workspace-owned asset record that can be attached to multiple consumers without duplicating storage or losing provenance.

The existing `Media` and newsletter image records should be migrated through compatibility adapters, not rewritten in place without evidence.

### 6. Scheduling is fragmented

Vercel cron routes independently process blogs, email campaigns, newsletters, referrals, social, Google reviews, and analytics. They use different state and retry models.

V2 needs a shared execution contract while preserving domain-specific state machines:

- Explicit workspace ownership
- Idempotency key
- Due time and timezone snapshot
- Lease and heartbeat
- Attempt count and retry policy
- Sanitized last error
- Terminal outcome
- Actor or automation authority
- Immutable input snapshot

### 7. White-label settings are incomplete

`SiteSettings` contains substantial Helios-specific content and an optional workspace relation. V2 needs workspace-owned brand, domain, email sender, terminology, navigation, template, feature, and entitlement configuration with safe defaults and validation.

### 8. Platform operations are not separated

The current OWNER role is a workspace role. White-label operation requires a platform control plane that cannot be reached through normal tenant administration and cannot silently impersonate customers.

## Required security invariants

Before a second tenant is provisioned:

1. Every persisted root has an explicit ownership classification.
2. Every authenticated mutation obtains workspace from the verified server session, never the request body.
3. Every public request resolves workspace from an approved host mapping.
4. Every cron and background job carries workspace ownership in its immutable payload.
5. Every webhook resolves tenant through a verified connection or message identifier.
6. Every R2 key begins with an immutable workspace namespace.
7. Every AI context query is workspace-scoped before prompt construction.
8. Every cache key and idempotency key includes workspace identity.
9. Every analytics event is workspace-scoped.
10. Cross-workspace identifiers return not found or forbidden without confirming record existence.

## Immediate recommendation

Do not add a second tenant yet. Complete the ownership map, host resolver, identity/membership design, shared asset design, and tenant-isolation test harness first. Preserve the current Helios behavior behind compatibility paths while these foundations are introduced.

## 2026-09-11 repeatable ownership inventory

Run `node scripts/audit/tenant-ownership.mjs` to refresh `docs/helios-studio-v2-ownership-inventory.json`. It reads tracked source/schema/configuration only, not environment values or a database. Current inventory: 111 models, 138 route files, one detected server-action file and six configured cron routes. Of the models, 27 have required workspace fields, 16 nullable fields and 68 no direct workspace field.

These numbers are not completion percentages or an isolation verdict. Many child records inherit ownership; creator/account relations do not establish immutable ownership. Every model includes its explicit foreign keys, uniqueness constraints and lexical delegate references so the review can follow actual data paths. Aliases, wrappers, raw SQL, cache behavior, storage usage and hosted integration behavior still need semantic inspection.

Remaining unowned content roots include ClientPortal and ReferralCampaign. TeamMember, AboutPageContent, EmailCampaign and Inquiry now have nullable ownership expansions; verified backfills, complete flow isolation and contract gates remain open. OperationalIncident, ReferralCronInvocation and AuditEvent need platform-versus-tenant visibility rules. CommunicationClient and global marketing preferences/suppression require careful shared-identity/consent handling without weakening existing opt-outs. These are prioritized review targets, not authorization to modify protected provider connections.

The six scheduled routes are newsletters, blog series, referrals, email campaigns, social studio and portfolio analytics. This inventory does not execute them. Production schedules, tokens, destinations and delivery histories remain untouched.
