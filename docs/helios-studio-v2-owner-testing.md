# Studio V2 owner testing milestone

Production ON HOLD. This guide describes the next non-production owner-testing pass, not an assertion that hosted access is ready.

## What is implemented

- `/admin/studio`: workspace identity, responsive navigation, attention items, upcoming work and recent projects from existing scoped services.
- Existing module destinations remain integrated under the V2 shell for eligible administrators.
- Read-only newsletter job review distinguishes jobs held after reactivation and links to edition generation/delivery review.
- Valid unchanged future newsletter schedules survive reactivation; overdue work is held. SEND, GENERATE and approval-deadline admission are checked under workspace locks. Uncertain provider outcomes retain their separate review rules.

Newsletter Studio retains its existing single-company HTTP admission guard. In a multi-workspace environment its routes remain unavailable pending module qualification. A separate Studio read-only job projection is in qualification; it does not admit edition mutations and clearly hides unavailable edition-action links. Do not remove that guard just to expose the new controls.

## Safe test environment

Use the existing isolated non-production process and synthetic companies. The shell requires tenant mode, `STUDIO_V2_SHELL_ENABLED=true`, an exact `STUDIO_V2_SHELL_WORKSPACE_IDS` allowlist and a current OWNER/ADMIN membership. Do not turn on whole-workspace lifecycle rollout solely to test the shell. Other outbound families remain unqualified for that rollout.

Do not infer provider readiness from dashboard counts. Do not use production records, real recipients or active provider credentials in the initial owner pass. Hosted project identity, access and existing deployment guards must be verified before staging publication. Current Vercel connector inspection returns 404; GitHub Vercel bot evidence reports skipped automatic deployments. There is no newly qualified hosted owner-testing URL.

## Owner tasks and useful feedback

| Task | Expected outcome | Feedback to capture |
| --- | --- | --- |
| Open Command Center | Correct company branding, role and owned project/attention records | Can you identify the most important next action? |
| Navigate Projects, Media, Clients and marketing modules | Existing working module routes, correct active navigation | Missing destinations or labels that do not match your workflow |
| Open attention and upcoming items | Direct path to existing review/editing screens | Whether the linked screen makes the next action clear |
| Inspect newsletter jobs | Explicit refresh, bounded status snapshot and held-work explanation | Whether held, claimed and uncertain work are distinguishable |
| Use mobile and keyboard navigation | Disclosure menu, skip link, visible focus and readable controls without horizontal overflow | Any inaccessible or awkward control |
| Refresh a temporarily unavailable section | Unavailable state remains distinct from an empty result | Wording that suggests a false success or hidden work |

Viewing these surfaces does not send, approve, retry or replay work. Existing module actions retain their own confirmation and authorization requirements.

## Next product slice

The active schedule-editor candidate exposes deliberate edition date changes in the existing editor; qualify it before owner use. The server already implements rescheduling, but the editor has no visible date-change control. The implementation must carry a reviewed row version, reject stale edits, show the scheduling timezone, explain that existing approval is revoked, and require new approval before sending. Active claims and uncertain delivery evidence must continue to block unsafe recovery. Qualify actual owner workflow behavior alongside tenant, lifecycle and revision boundaries.

Use owner feedback to choose the next functional module integration. Do not create unrelated hardening packets as a prerequisite for this read-only Studio experience.
