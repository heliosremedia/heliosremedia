# Phase 1 owner decision: platform support access

Status: **PROPOSED — owner decision required; no access capability or enrollment authorized.**

This proposal is not a completed packet or a Phase 1 exit report. Production remains ON HOLD. It grants nobody access and changes no application, schema, credentials, provider or deployment configuration.

## Decision requested

Approve the following boundary for the first **non-production** implementation: a current tenant OWNER must consent to each named platform operator's diagnostic session; each grant lasts at most 30 minutes, is revocable and audited; the initial capability is read-only, allowlisted diagnostics. No self-grant, impersonation, customer-content browsing, writes, credential access, exports or emergency bypass is included.

This changes who may exercise authority across workspace boundaries. The user's standing authorization reserves consequential security/architecture decisions for Jake. The canonical design establishes expiring support grants, but does not settle consent authority, duration or the first access scope. Those policy choices must be explicit before code establishes a new cross-workspace privilege.

## Verified repository basis

Reviewed against Packet 76 candidate `fee7325d36da838798183c33dc10744f03174c87`; these identity/support sources are unchanged from the verified Packet 75 integration `7475f116cdd31039fdca415f5a768fdf6314be98`.

| Source | Existing contract | Remaining decision or implementation |
| --- | --- | --- |
| [Charter](helios-studio-v2-charter.md), working principle 8 and isolation milestone | Support must be explicit, time-limited and audited; tenant content needs a support grant | Who consents and which first capabilities the grant permits |
| [Architecture](helios-studio-v2-architecture.md), tenant context and target identity | Separately granted PlatformRole; SupportAccessGrant names workspace, operator, reason and expiration | Enrollment authority, consent policy and enforced capability scope |
| [Roadmap](helios-studio-v2-roadmap.md), Phase 1 | Platform/support boundary is a tenant-foundation deliverable | Must qualify actual enforcement; a context label is insufficient |
| [Schema](../prisma/schema.prisma), AdminUser and WorkspaceMembership | AdminUser still requires one workspace; membership roles belong to a workspace | No persisted PlatformRole or SupportAccessGrant model exists in this head |
| [Session](../lib/auth/session.ts), [membership resolution](../lib/workspace-memberships.ts) | Session re-resolves active account, session version and current membership; returns that workspace | A tenant OWNER must never become a platform operator by inference |
| [Context type](../lib/workspace-context-core.ts) | The source union contains `platform-support` | No grant verifier, support endpoint or impersonation flow was found by source inventory; the type is not proof of authorization |
| [Phase 1 checkpoint](helios-studio-v2-phase1-checkpoint.md) | Support/lifecycle remains open independently of qualified content mutations | This proposal does not close that surface |

## Proposed policy

1. **Independent operator enrollment.** Persist separately granted platform authority. Tenant roles cannot create, infer or elevate it. Begin with no enrolled real operators. Initial real enrollment remains an owner/security action; local tests use synthetic operators only.
2. **Tenant consent.** A currently authorized OWNER of the target workspace creates a grant for a pre-enrolled named operator, a required reason and a fixed diagnostic scope. ADMIN/EDITOR/VIEWER cannot grant. Being a platform operator does not allow self-approval or choosing another workspace through a request parameter. Where an operator is also a tenant OWNER, a different current OWNER must approve that operator's grant; no emergency exception is implied.
3. **Bounded lifetime.** Maximum 30 minutes from database time, with no automatic extension or sliding session. A new grant requires fresh consent and a new audit event. A current tenant OWNER can revoke it. Expired/revoked grants, inactive operators, removed platform authority, stale operator sessions, and a no-longer-authorized granting OWNER deny subsequent reads.
4. **Diagnostic scope only.** The first endpoint returns a fixed response schema: the granted workspace identity and bounded counts/statuses from explicitly owned records. No names/emails of customers or staff, content bodies, media URLs, raw logs/provider responses, tokens, connection strings or credentials. An exact field allowlist must be reviewed with the implementation. Unknown diagnostic scopes fail closed.
5. **Separate execution context.** Retain both operator identity and granted target identity. Do not rewrite a normal tenant session or accept a browser-selected workspace as authority. A support context cannot call existing tenant mutation handlers, public content readers or worker/provider operations. This is not a general-purpose impersonation session.
6. **Audited and revocable use.** Record grant creation, use, denial and revocation with operator, granting owner, workspace, reason reference, scope, request ID and bounded outcome. Allowed data is returned only after its required audit commits. Check current grant/identity state at read admission, retain locks through the bounded diagnostic read, and recheck expiry before release. Audit failure returns no diagnostic data. In-flight response timing cannot promise recall of bytes already released; revocation fences subsequent admissions.
7. **Preserve authentication compatibility.** No new identity provider, session-format replacement, user backfill or production identity migration in this first slice. Separately granted operator authority may bind the existing verified account ID while the canonical User migration remains separately planned. Do not reinterpret the account's home-workspace membership as support authority.

## Reviewable next implementation boundary, after this decision

- Add only the persisted operator/grant authority and audit enforcement required for the approved scope, initially empty and disabled for real use.
- Add owner-only grant/revoke admission and one fixed read-only diagnostic endpoint. No generic table browser, SQL executor, credential viewer or impersonation UI.
- Exercise synthetic workspaces/operators with real HTTP and disposable PostgreSQL. Prove tenant-role escalation denial; unregistered operator denial; wrong operator/workspace/scope; self-grant denial; expiry/revocation/demotion/session-version races; audit-failure containment; denied writes; and absence of foreign tenant fields in the allowlisted response.
- Define and verify lock order before implementation; cover cross-workspace grant/identity revocation contention. Existing membership mutation semantics must remain intact.
- Preserve full regression/TypeScript/Chromium, isolated qualification, independent artifact verification and merge-tree equality. Any additive schema rehearsal stays in disposable/non-production qualification; no production migration or real operator enrollment follows from policy approval.

## Open work remains explicit

Even approval and successful implementation of this scope would not establish full support impersonation, emergency access, workspace lifecycle behavior, hosted/CDN parity, all remaining content/job/AI/analytics families, or the final Helios compatibility and second-company isolation verdict. Those remain tracked Phase 1 gaps or later explicitly authorized scopes. No completion percentage is inferred.

This is a consequential policy gate, not a request to approve ordinary CI, fixes, merges or continued non-production development. Once Jake accepts or changes the proposed consent/access boundary, implementation can continue under the existing standing authorization within that boundary.
