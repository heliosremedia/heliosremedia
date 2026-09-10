# Helios Studio V2 Delivery Roadmap

## Phase 0: baseline and containment

Deliverables:

- Product charter and architecture decisions
- Complete model ownership map
- Current test and deployment baseline
- Protected integration inventory
- Known-defect register
- V2 branch and release gates

Exit criteria:

- Existing failures are classified.
- No V2 code has changed production behavior.
- Every production integration has an owner and rollback boundary.

## Phase 1: tenant foundation

Deliverables:

- Host-to-workspace domain registry
- Identity and workspace membership model
- Authoritative request workspace context
- Workspace-owned roots and tenant-aware unique constraints
- Tenant-isolation test harness
- Platform and support-access boundary
- Workspace lifecycle states

Exit criteria:

- Negative cross-tenant tests cover admin, public, API, job, webhook, storage, AI, cache, and analytics paths.
- Helios continues operating through compatibility paths.
- A synthetic second tenant cannot read or mutate Helios data.

## Phase 2: shared media and jobs

Deliverables:

- Workspace-owned asset registry
- Variants, usages, provenance, and lifecycle
- Compatibility adapters for current media records
- Shared job mechanics and operational dashboard
- Retry, lease, heartbeat, cancellation, and recovery controls
- Provider health aggregation

Exit criteria:

- Existing project, portfolio, newsletter, blog, and social media remain intact.
- Scheduled work is observable and safely retryable.
- No live provider connection is migrated without parity evidence.

## Phase 3: V2 shell and command center

Deliverables:

- Consistent navigation and page layout
- Shared editor, uploader, picker, preview, approval, and schedule components
- Command Center focused on attention, schedules, failures, approvals, and connection health
- Responsive approval and operational actions

Exit criteria:

- V2 shell can be enabled only for Helios administrators.
- V1 routes remain available for rollback.
- Accessibility and responsive QA pass.

## Phase 4: operational domain migration

Recommended order:

1. Projects and Portfolio
2. Clients and Inquiries
3. Email and Newsletters
4. Blog
5. Referrals
6. Social
7. Analytics and reporting

Each domain requires:

- Ownership backfill
- Read and write parity
- State-machine parity
- Audit parity
- Data reconciliation
- Feature-flag rollout
- Rollback rehearsal

## Phase 5: white-label configuration

Deliverables:

- Brand profile
- Custom domains
- Branded sender configuration
- Supported terminology controls
- Service and template configuration
- Module entitlements
- Guided tenant onboarding
- Import, export, suspension, and deletion workflows

Exit criteria:

- A synthetic tenant can be provisioned without code changes.
- No arbitrary tenant CSS or application fork is required.

## Phase 6: commercial platform

Deliverables:

- Plans and Stripe billing
- Usage metering, quotas, and overage policy
- Customer documentation and support tools
- Status communication and incident workflow
- Data-processing, privacy, retention, and acceptable-use policies
- Pilot onboarding and feedback process

Exit criteria:

- Billing and entitlements reconcile.
- Tenant export and recovery are rehearsed.
- Two or three selected media companies are ready for a controlled paid pilot.

## Phase 7: general availability

Requirements:

- Independent tenant-isolation security review
- Measured reliability objectives
- Backup restoration evidence
- Support coverage and escalation ownership
- Commercial terms and onboarding capacity
- Pilot retention and workflow-fit evidence

## Release discipline

Every implementation slice must include:

- Scope and protected systems
- Data migration and reconciliation plan
- Automated tests
- Preview evidence
- Production smoke test
- Metrics and alerts
- Rollback mechanism
- Post-release verification

No release is complete because a page renders. It is complete when its data, authorization, execution, observability, and recovery story are verified end to end.
