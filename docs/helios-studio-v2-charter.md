# Helios Studio V2 Product Charter

## North star

Build the operating system for real estate media companies, proven first by Helios Real Estate Media.

Helios Studio V2 is a multi-tenant software product, not a Helios-only admin redesign. Helios is the reference tenant and must continue operating throughout the migration. The product is not commercially ready until a second tenant can be created, configured, operated, exported, and removed without exposing or changing Helios data.

## Product outcomes

V2 must give a media company one reliable place to operate:

- Projects and media
- Portfolio and website content
- Clients and inquiries
- Email, newsletters, blog, referrals, and social content
- Approvals, scheduling, and publishing
- Integrations and system health
- Analytics and team accountability
- Brand, domain, feature, usage, and subscription settings

## Product principles

1. **Reliability before novelty.** A scheduled or approved action must be observable, idempotent, recoverable, and auditable.
2. **Tenant isolation by construction.** Every request, query, job, asset, AI prompt, webhook, and analytics event must resolve an authoritative workspace.
3. **Configuration instead of forks.** White-label customers may configure supported brand and workflow options. They do not receive custom application forks.
4. **One asset, one identity.** Media is uploaded once and reused by projects, portfolio, email, blog, social, and websites.
5. **One publishing contract.** Scheduled work uses a shared job contract with explicit state, ownership, leases, retries, and terminal outcomes.
6. **AI proposes; people approve.** AI cannot silently publish, change brand policy, invent facts, or cross tenant boundaries.
7. **Helios remains operational.** V2 ships incrementally behind flags. Existing URLs, records, connections, schedules, and public experiences remain intact until parity is verified.
8. **Support is safe.** Platform operators receive diagnostics and controlled impersonation only through explicit, time-limited, audited access.

## Standardized white-label surface

Tenant configuration may include:

- Company name, logo, monogram, colors, and approved fonts
- Custom domains and branded email senders
- Service catalog and terminology
- Navigation visibility and public-page content
- Templates, content rules, and approval policy
- Enabled modules, integrations, limits, and plan entitlements

Tenant configuration must not include arbitrary code, arbitrary database fields, unrestricted CSS, or tenant-specific forks.

## V2 information architecture

1. Command Center
2. Projects
3. Media Library
4. Portfolio and Website
5. Marketing Studio
6. Clients and Inquiries
7. Calendar and Publishing
8. Analytics
9. Integrations and System Health
10. Team and Permissions
11. Brand and White Label
12. Subscription and Usage

Email, newsletters, blog, referrals, and social remain recognizable workflows inside Marketing Studio. Consolidation must not erase their domain-specific approval and delivery requirements.

## Release gates

### Gate A: foundation

- Current architecture and known failures are documented.
- Tenant ownership rules exist for every persistent model.
- Workspace resolution is explicit for authenticated, public, cron, webhook, and background-job entry points.
- Protected production integrations have regression baselines.

### Gate B: Helios parity

- Helios workflows operate through V2 without record loss or URL changes.
- Uploading, scheduling, publishing, delivery feedback, and retries are verified end to end.
- V1 remains available as a rollback path while V2 is feature flagged.

### Gate C: second-tenant proof

- A non-production pilot tenant can be provisioned with isolated users, domains, storage, clients, projects, content, jobs, integrations, and analytics.
- Automated cross-tenant negative tests pass.
- Platform support cannot access tenant content without an audited support grant.

### Gate D: paid pilot

- Billing, entitlements, quotas, onboarding, export, deletion, documentation, support, and incident response are operational.
- Two or three selected media companies complete a controlled paid pilot.

### Gate E: general availability

- Tenant isolation has received an independent security review.
- Backup restoration and tenant export have been rehearsed.
- Reliability objectives and support ownership are defined and measured.

## Explicit non-goals for the foundation release

- No big-bang rewrite
- No immediate public self-service signup
- No broad marketplace of tenant-specific customizations
- No production migration of protected Meta credentials
- No replacement of working provider adapters solely for architectural purity
- No commercial launch before second-tenant isolation is proven

## Decision authority

The V2 program may proceed incrementally within this charter. Production migrations, destructive data changes, credential changes, live publishing tests, billing activation, and external customer onboarding require an explicit release gate with evidence and a rollback plan.
