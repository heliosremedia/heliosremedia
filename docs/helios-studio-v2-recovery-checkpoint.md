# Studio V2 live recovery checkpoint

Updated October 8, 2026. Production ON HOLD. Resume from live GitHub, not interrupted local files.

## Verified integration

Branch: `codex/v2-hosted-access-owner-action`.
Latest verified application integration: `487373c22d2399c5ef124b63b5c0ceaa7560a49b` (PR #398).
Tree: `e29981b9d418abb9508276b83bb5f721d2b626a2`, independently verified equal to qualified candidate `cebbfa354a22fdae35232db5126df19d5697ceff`.

| Completed capability | PR / integrated SHA | Qualification |
| --- | --- | --- |
| Approved scheduling policy, bounded readiness assessment, concurrent product milestones | #394 / `ed6c71fb4a12ef4170c558c1ac48ea33787afccf` | Regression 37844736236 passed; candidate/integration tree equality |
| Newsletter future-schedule preservation and overdue admission holds | #395 / `f48f9e6162ea7083305584152bc3ff13731a336e` | 1,842 tests, TypeScript, Chromium; runtime 37846163053; artifact 11579129010 independently verified |
| Workspace shell, navigation and Command Center over existing modules | #396 / `4238b8a5d438e0d8cb9237af85dbe901ae6a6937` | 1,845 tests, TypeScript and Chromium in 37848492261; runtime 37848492202; artifacts independently verified, responsive screenshots inspected |
| Held newsletter jobs and existing edition review links in Command Center | #397 / `53c4575ce07e3e63b4d734c90170e7bd2e8fb014` | 1,845 tests, TypeScript and Chromium in 37848572069; runtime 37848571925; both owned review cases and responsive screenshots verified |
| Claimed approval-deadline lifecycle admission | #398 / `487373c22d2399c5ef124b63b5c0ceaa7560a49b` | 1,846 tests, TypeScript and all Chromium in 37848781381; runtime 37848781385; six actual database waits across two companies and unchanged denied deadline mutations |

All implementation merges targeted only the non-production integration branch. Prospective and integrated trees were compared with qualified candidate trees. Main and production were not changed.

## Independent artifact evidence

Artifacts were downloaded separately, ZIP SHA256 matched to GitHub metadata, JSON parsed, exact candidate checked, and tenant cases plus schema/access restoration inspected.

| Runtime artifact | Candidate | ZIP SHA256 |
| --- | --- | --- |
| 11579129010 | `02b4252ffc5ee147cb1f73a592385bbc04119b03` | `75f02270c51e8a4fb1d0cc0969be38f3f6ef1bf57a5235a4263f3ef59203f7b1` |
| 11581041434 | `de1c85f4ad3ba75a5d55780d35d951b8d8af1da5` | `7b9312c4d6e08e0c73b0f44e35a09ab75a8feb6326307ef959f35d9ec089ffd9` |
| 11580672168 | `771cec6591ea58c5f716c2906cb102b4d7c8d026` | `3c855dc20ddf15aba17eae8cd74b78b1cb00cbf6dfd1c140bd9674f87f1a62ec` |
| 11581686010 | `cebbfa354a22fdae35232db5126df19d5697ceff` | `d96caf42c37ef9d99d3a6e4dc6ac2b2564bfc5e24c40a65b016230092045c9bd` |

Screenshot artifacts: 11581027188 (`69819f6722336a75ade93ad19b8d5abe839b71e88ceb63d42b105838ed0d058a`) and 11580952281 (`b2b0013e5a03d4597c78686d1a9136cd0b7f59b2b7e72fc5058d3fdd5eae9bbe`). Mobile and desktop images inspected. Inspection found and corrected global link-reset interference with primary action contrast; a computed-color browser assertion now guards it. Local Chromium installation failed with an invalid downloaded archive; browser passes come from CI.

## Active work and immediate next action

PR #399: `codex/v2-newsletter-schedule-editor`, candidate `6483f35ce50225b3412ee19423404e5b4d6eab72`, tree `3272f9374464b71316ce966b0a3646b35b14e559`. Runtime 37851611475 passed supported single-company HTTP editing, then both-company module hold and the full two-tenant suite. Regression 37851611471 remains in progress at preparation; independent artifact and screenshot verification are still required.

Branch `codex/v2-newsletter-schedule-editor` builds on verified integration. Implements the missing visible date-change control in the existing edition editor. Uses existing reschedule operation, adds an optional explicit reviewed-version check for new callers, returns the version in the existing edition DTO, and explains UTC/new approval requirements. Unsaved drafts must be saved first. Unconfirmed results require reload instead of an automatic repeat. Existing clients retain current-request revision checks.

Focused transition/route tests cover stale and malformed versions. Browser coverage exercises confirmation, exact UTC conversion, Escape, and unconfirmed-result handling. New actual HTTP/PostgreSQL qualification covers the supported single-company workflow, foreign/anonymous/viewer/suspended denial, active-claim rollback, prior approval revocation, queued send cancellation, stale replay and new-review state. No provider or approval action is added. Newsletter Studio intentionally remains HTTP-disabled when multiple workspaces exist. The fresh disposable database first seeds company A and checks its supported flow, then adds company B and verifies both-company module denial before running the unchanged two-tenant qualification suite. No database reset or guard substitution is used.

Next independent capability is implemented on `codex/v2-studio-job-review`: a read-only Studio job projection using existing current-session/explicit-workspace rollout admission and the locked owned job-health service. The original Newsletter Studio HTTP gate is unchanged. The response explicitly disables edition-action links when the broader module is unavailable. Qualification adds actual two-company HTTP reads, forged-selector/role/revocation/suspension denial, private no-store responses, unchanged original module denial, POST 405 and client rendering without misleading links. Four focused service/route/client tests pass; full exact-head CI remains required.

Finish exact-head full regression, TypeScript, Chromium, screenshot inspection and independent runtime artifact verification before merging. Preserve tested-tree equality. Then continue owner-testable module workflows; use `helios-studio-v2-owner-testing.md` and owner feedback to select the next capability. Do not manufacture unrelated hardening packets.

## Risks and boundaries

- Newsletter Studio retains its existing single-company HTTP guard. Until the Studio job-review candidate qualifies, Command Center job-health refresh inherits that restriction. Direct scoped-service evidence does not qualify the broader module for multi-workspace HTTP use. This is an explicit feature dependency before broader newsletter owner testing.
- Whole lifecycle activation remains disabled. Newsletter notifications and other email/referral/social/AI/provider families need their own admission and settlement qualification alongside their features.
- Hosted Neon/Vercel/CDN parity and complete Helios/second-company compatibility remain release dependencies. Synthetic PostgreSQL/Next proof does not close them.
- Vercel connector inspection returned 404 for both known project IDs under the known team. Live Vercel bot comments on #396 and #398 report two skipped/ignored automatic deployments. Settings were not changed. No newly qualified hosted owner-testing URL exists.
- Shell is default-off with an explicit workspace allowlist and current OWNER/ADMIN access. It summarizes persisted module data, not verified live provider health.
- No production changes, billing, real external onboarding or provider activation occurred.

Standing authorization: continue reversible non-production implementation, tests, staging qualification, qualified merges and next milestones without routine permission. Owner-only stops remain production, destructive/irreversible operations, consequential security/architecture choices, billing, real external onboarding and material unexpected risk.
