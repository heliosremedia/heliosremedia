# Studio V2 owner testing milestone

Production ON HOLD. This guide describes the next non-production owner-testing pass, not an assertion that hosted access is ready.

## What is implemented

- `/admin/studio`: workspace identity, responsive navigation, attention items, upcoming work and recent projects from existing scoped services.
- Existing module destinations remain integrated under the V2 shell for eligible administrators.
- Read-only newsletter job review distinguishes jobs held after reactivation and links to edition generation/delivery review.
- Valid unchanged future newsletter schedules survive reactivation; overdue work is held. SEND, GENERATE and approval-deadline admission are checked under workspace locks. Uncertain provider outcomes retain their separate review rules.

Newsletter Studio retains its existing single-company HTTP admission guard. In a multi-workspace environment its routes remain unavailable pending module qualification. A separately qualified Studio read-only job projection is integrated; it does not admit edition mutations and clearly hides unavailable edition-action links. Do not remove that guard just to expose the new controls.

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

Projects and Media are the active product milestone. The integrated workspace library scopes list/search/counts and selected projects to the current session, distinguishes empty workspaces from empty search results, and links selected projects directly to media controls. Qualification covers actual two-company HTTP and responsive page rendering; isolated qualification and screenshot gates are complete; hosted access remains separate.

The newsletter date-change editor is integrated. It carries a reviewed row version, rejects stale edits, explains UTC and approval revocation, and requires new approval. Existing single-company admission and uncertain-delivery rules remain.

The integrated project-detail editor preserves unsaved text after conflicts and uncertain saves, requires an explicit reload before another save, and retains the existing dialog with keyboard focus containment. Concurrent stale edits are rejected under an owned project lock and fresh workspace authorization. Its two-company runtime, regression and responsive browser gates are complete.

The draft-creation candidate preserves fields on validation/transport failure, pauses uncertain creation for review, and uses a stable owned submission identity to avoid duplicate drafts on replay. Actual Next form submission and two-company permission races must qualify before owner use.

PR #405 is qualifying reviewed media metadata saves and draft recovery. Next: complete media additions and metadata editing using the existing upload/provider containment. Resolve demonstrated dependencies alongside these workflows. No hosted owner URL or broader rollout is claimed.
