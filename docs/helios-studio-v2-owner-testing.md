# Studio V2 owner testing milestone

Production ON HOLD. This guide describes the next non-production owner-testing pass, not an assertion that hosted access is ready.

## What is implemented

- `/admin/studio`: workspace identity, responsive navigation, attention items, upcoming work and recent projects from existing scoped services.
- Existing module destinations remain integrated under the V2 shell for eligible administrators.
- Workspace Media Library search/counts and project media links are scoped to the current company.
- Private draft creation preserves form state and prevents duplicate drafts on replay.
- Progress cards and media links open the corresponding setup panel while preserving mounted local fields.
- Project details, media metadata and service selections use reviewed revisions and preserve unsaved work during conflict or uncertainty.
- Unmet setup requirements lead directly to the appropriate panel. Saved details can flow into a fresh service edit without rebasing an already-started selection.
- Reviewed Move to draft and Archive actions retain project content, reject stale/current-access changes and pause for explicit saved-state review after an uncertain response.
- Private review creates an expiring link without publishing. Opening, copying, manual-copy fallback and deliberate revocation are separate actions; uncertain outcomes require saved-state review.
- Read-only newsletter job review distinguishes jobs held after reactivation and links to edition generation/delivery review.
- Valid unchanged future newsletter schedules survive reactivation; overdue work is held. SEND, GENERATE and approval-deadline admission are checked under workspace locks. Uncertain provider outcomes retain their separate review rules.

Newsletter Studio retains its existing single-company HTTP admission guard. In a multi-workspace environment its routes remain unavailable pending module qualification. A separately qualified Studio read-only job projection is integrated; it does not admit edition mutations and clearly hides unavailable edition-action links. Do not remove that guard just to expose the new controls.

## Safe test environment

Use the existing isolated non-production process and synthetic companies. The shell requires tenant mode, `STUDIO_V2_SHELL_ENABLED=true`, an exact `STUDIO_V2_SHELL_WORKSPACE_IDS` allowlist and a current OWNER/ADMIN membership. Do not turn on whole-workspace lifecycle rollout solely to test the shell. Other outbound families remain unqualified for that rollout.

Do not infer provider readiness from dashboard counts. Do not use production records, real recipients or active provider credentials in the initial owner pass. Hosted project identity, access and existing deployment guards must be verified before staging publication. Default-scope Vercel discovery now confirms the existing staging project; explicit scope selectors return empty/404. The last independently recovered hosted success is September source, not current Studio. No current hosted owner-testing URL is qualified.

## Owner tasks and useful feedback

| Task | Expected outcome | Feedback to capture |
| --- | --- | --- |
| Open Command Center | Correct company branding, role and owned project/attention records | Can you identify the most important next action? |
| Navigate Projects, Media, Clients and marketing modules | Existing working module routes, correct active navigation | Missing destinations or labels that do not match your workflow |
| Open attention and upcoming items | Direct path to existing review/editing screens | Whether the linked screen makes the next action clear |
| Inspect newsletter jobs | Explicit refresh, bounded status snapshot and held-work explanation | Whether held, claimed and uncertain work are distinguishable |
| Create a private project draft  | Entered fields survive validation; confirmed creation opens the owned draft; uncertain creation pauses for Projects review | Any lost fields, duplicate draft or unclear next step |
| Edit project details | Save the reviewed record; a competing edit preserves local text and requires reload | Whether conflict recovery is understandable |
| Edit media metadata  | Preserve filename, alt text and caption on conflict; review saved media before another edit | Whether the recovery control is reachable on mobile |
| Configure services | Saved selection survives concurrent changes and uncertain responses; media-added assignments are retained | Whether selections and reload controls remain readable |
| Review privately | Create an expiring link, open the private preview, copy its address and revoke deliberately; the project remains a draft | Any false success, duplicate creation after clipboard failure or ambiguous link status |
| Move between setup steps | Progress cards, requirement links and the media action open the appropriate panel without dropping local fields | Whether the next task is clear |
| Use mobile and keyboard navigation | Disclosure menu, skip link, visible focus and readable controls without horizontal overflow | Any inaccessible or awkward control |
| Refresh a temporarily unavailable section | Unavailable state remains distinct from an empty result | Wording that suggests a false success or hidden work |

Viewing these surfaces does not send, approve, retry or replay work. Existing module actions retain their own confirmation and authorization requirements.

## Next product slice

Projects and Media are the active product milestone. The integrated workspace library scopes list/search/counts and selected projects to the current session, distinguishes empty workspaces from empty search results, and links selected projects directly to media controls. Qualification covers actual two-company HTTP and responsive page rendering; isolated qualification and screenshot gates are complete; hosted access remains separate.

The newsletter date-change editor is integrated. It carries a reviewed row version, rejects stale edits, explains UTC and approval revocation, and requires new approval. Existing single-company admission and uncertain-delivery rules remain.

The integrated project-detail editor preserves unsaved text after conflicts and uncertain saves, requires an explicit reload before another save, and retains the existing dialog with keyboard focus containment. Concurrent stale edits are rejected under an owned project lock and fresh workspace authorization. Its two-company runtime, regression and responsive browser gates are complete.

The integrated draft-creation workflow preserves fields on validation/transport failure, pauses uncertain creation for review, and uses a stable owned submission identity to avoid duplicate drafts on replay. Actual Next form submission/replay, two-company permission races and responsive recovery are qualified in isolation.

The private-project pass starts with ordinary password sign-in through the actual login endpoint, rejects an incorrect password, opens Command Center with the issued cookie, and composes the actual draft Server Action and existing details, registered synthetic media upload/attachment, media edit, service assignment, workspace library, review page, private preview and revocation routes on one new project in each of two companies. Both projects remain unpublished. Logout clears the session cookie, and synthetic credentials/login metadata and owned auth audit fixtures are restored exactly. Responsive actual-component Chromium separately checks owner controls, retained drafts, clipboard fallback, explicit labels, uncertain states and recovery at 390px and 1440px. Exact candidates, artifacts and integrated commits are in the canonical recovery checkpoint.

This evidence is isolated Next/PostgreSQL and synthetic provider qualification. It is not hosted owner access, live-provider parity, public publishing qualification or First Light. October 10 discovery confirms the staging project and connected Git integration. Current source/schema admission, persistent owner login and shell rollout still require qualification; Neon metadata discovery currently fails with an internal authorization error. No new hosted testing URL has been qualified.

## Private-project test sequence

1. Create a synthetic private draft from Projects, then edit and save its information.
2. Use a progress card or Upload media to open Media. Add synthetic media through the qualified isolated storage/provider setup; edit its metadata.
3. Choose and save project services. If another change or an uncertain response intervenes, preserve the selection and use the explicit saved-state review path.
4. Open Review and Publish to inspect completion requirements. Follow an unmet requirement back to setup, or use Review privately.
5. Create a short-lived private review link. Open it and inspect the draft. If clipboard access is unavailable, copy the visible address manually; creating another link is unnecessary.
6. Revoke the review link deliberately, then confirm that it no longer grants access. The project should still be a draft.

Reviewed unpublish/archive controls are integrated and independently qualified. Public publishing and featured placement remain bounded qualification dependencies. This private pass does not invoke them. Production remains ON HOLD; no real customer onboarding or live provider activation is authorized.
