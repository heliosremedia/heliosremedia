# Studio V2 live recovery checkpoint

Updated October 8, 2026. Production ON HOLD. Resume from live GitHub, not interrupted local files.

## Verified integration

Branch: `codex/v2-hosted-access-owner-action`.
Latest verified application integration: `73348157c4b05dc1865e8aac47b8130f6717a0ac` (PR #399).
Tree: `3272f9374464b71316ce966b0a3646b35b14e559`, independently verified equal to qualified candidate `6483f35ce50225b3412ee19423404e5b4d6eab72`. Live GitHub ref reverified after the execution environment disconnected.

| Completed capability | PR / integrated SHA | Qualification |
| --- | --- | --- |
| Approved scheduling policy, bounded readiness assessment, concurrent product milestones | #394 / `ed6c71fb4a12ef4170c558c1ac48ea33787afccf` | Regression 37844736236 passed; candidate/integration tree equality |
| Newsletter future-schedule preservation and overdue admission holds | #395 / `f48f9e6162ea7083305584152bc3ff13731a336e` | 1,842 tests, TypeScript, Chromium; runtime 37846163053; artifact 11579129010 independently verified |
| Workspace shell, navigation and Command Center over existing modules | #396 / `4238b8a5d438e0d8cb9237af85dbe901ae6a6937` | 1,845 tests, TypeScript and Chromium in 37848492261; runtime 37848492202; artifacts independently verified, responsive screenshots inspected |
| Held newsletter jobs and existing edition review links in Command Center | #397 / `53c4575ce07e3e63b4d734c90170e7bd2e8fb014` | 1,845 tests, TypeScript and Chromium in 37848572069; runtime 37848571925; both owned review cases and responsive screenshots verified |
| Claimed approval-deadline lifecycle admission | #398 / `487373c22d2399c5ef124b63b5c0ceaa7560a49b` | 1,846 tests, TypeScript and all Chromium in 37848781381; runtime 37848781385; six actual database waits across two companies and unchanged denied deadline mutations |
| Deliberate reviewed date changes in the existing newsletter editor | #399 / `73348157c4b05dc1865e8aac47b8130f6717a0ac` | 1,846 tests, TypeScript and all Chromium in 37851611471; runtime 37851611475; supported single-company edit and preserved both-company module hold |

All implementation merges targeted only the non-production integration branch. Prospective and integrated trees were compared with qualified candidate trees. Main and production were not changed.

## Independent artifact evidence

Artifacts were downloaded separately, ZIP SHA256 matched to GitHub metadata, JSON parsed, exact candidate checked, and tenant cases plus schema/access restoration inspected.

| Runtime artifact | Candidate | ZIP SHA256 |
| --- | --- | --- |
| 11579129010 | `02b4252ffc5ee147cb1f73a592385bbc04119b03` | `75f02270c51e8a4fb1d0cc0969be38f3f6ef1bf57a5235a4263f3ef59203f7b1` |
| 11581041434 | `de1c85f4ad3ba75a5d55780d35d951b8d8af1da5` | `7b9312c4d6e08e0c73b0f44e35a09ab75a8feb6326307ef959f35d9ec089ffd9` |
| 11580672168 | `771cec6591ea58c5f716c2906cb102b4d7c8d026` | `3c855dc20ddf15aba17eae8cd74b78b1cb00cbf6dfd1c140bd9674f87f1a62ec` |
| 11581686010 | `cebbfa354a22fdae35232db5126df19d5697ceff` | `d96caf42c37ef9d99d3a6e4dc6ac2b2564bfc5e24c40a65b016230092045c9bd` |
| 11583075130 | `6483f35ce50225b3412ee19423404e5b4d6eab72` | `9d46da3e80e6e405eb9bef21dfa84b812d438c9cc1e91170dbbf2a1bef55395a` |
| 11582716612 (pending PR #400) | `9c39efa5a3dd139d1aadfbc65da35bf3135a0d0a` | `29b7beb050bcde8d2c831b89c9c288051e793b9105ac8a84aee233418ab59ab7` |

Screenshot artifacts: 11581027188 (`69819f6722336a75ade93ad19b8d5abe839b71e88ceb63d42b105838ed0d058a`) and 11580952281 (`b2b0013e5a03d4597c78686d1a9136cd0b7f59b2b7e72fc5058d3fdd5eae9bbe`). Mobile and desktop images inspected. Inspection found and corrected global link-reset interference with primary action contrast; a computed-color browser assertion now guards it. Local Chromium installation failed with an invalid downloaded archive; browser passes come from CI.

## Active work and immediate next action

The execution environment disconnected after all implementation CI completed. The exec server returned `409 Conflict, environment_offline: Environment is not connected`. GitHub remained available, so this checkpoint is committed remotely. Do not use the interrupted local workspace as authority.

**PR #399 is merged and complete.** The editor exposes deliberate UTC date changes through the existing reschedule operation, carries the reviewed row version, rejects stale edits and requires new approval. Unconfirmed results require reload. Runtime first qualifies the supported single-company HTTP flow, then adds the second synthetic workspace and proves the existing module hold before the full two-tenant suite. No reset or guard substitution is used. Screenshot artifact 11582811831 was independently verified against SHA256 `06d6d15b194d6fc984f54c2fa6aa2471dff2a95923dd04e2cc078bcd12d197e1`; mobile and desktop dialog images were inspected.

**PR #400 remains draft with one final gate.**

- Branch: `codex/v2-studio-job-review`.
- Candidate: `9c39efa5a3dd139d1aadfbc65da35bf3135a0d0a`.
- Tree: `fb5ce59f9391d70f0e9c5884a3f18b30b9140148`.
- Regression 37852201803, job 113567620886: all 1,847 tests, TypeScript and every Chromium step passed.
- Runtime 37852201829: passed. Artifact 11582716612 was independently downloaded/hash-verified and parsed; both-company owned held jobs, forged selectors, role/revocation/suspension denial, private no-store, preserved original module gate and schema/access restoration were verified.
- Screenshot artifact **11582228840** still needs independent download/hash verification and visual inspection. Expected ZIP SHA256: `79af4e2da5cfa31e2fbed69113a471fe40c74b9bfbc4529c1a913671f302ffe0`. Do not merge before completing that inspection.
- Prospective merge tree against integration 73348157 was verified equal to the candidate tree. Reverify live integration and PR head before merge.

PR #400 supplies a separate GET-only Studio job projection using current-session, explicit workspace rollout and the existing locked owned-service admission. The original newsletter module HTTP guard and mutation routes are unchanged. When the module is unavailable, the panel explains this and hides edition-action links. No send, retry, replay or provider action is introduced. This closes the observed Command Center refresh limitation without activating the broader newsletter module.

**Resume sequence**

1. Fresh clone/live GitHub verification; inspect any newer work first.
2. Download artifact 11582228840, verify its exact digest and inspect the 390px/1440px images. Confirm #400's head and all current checks; verify matching merge tree, mark ready and merge only into the non-production integration branch.
3. This recovery-only branch is stacked on #400. Do not merge it into integration ahead of #400, because its parent contains that pending implementation. After #400 qualifies, retarget the checkpoint PR, update its verified integrated SHA and merge the documentation through the normal process.
4. Continue the next product milestone: validate Projects and Media create/edit workflows under the Studio shell using synthetic owned records and existing upload/provider containment. Resolve concrete usability or state-recovery defects, with tenant/revision qualification alongside the feature. Hosted access diagnosis can proceed when the correct provider connection is available.
5. Maintain the owner-testing guide and next recovery checkpoint. Do not manufacture unrelated hardening packets.

Initial schedule-runtime failures were qualification assumptions: 37850304377 expected route-level 403 instead of proxy 401; 37850807028 attempted positive newsletter HTTP with two workspaces despite the existing module hold. Corrected qualification setup; failed-run logs confirmed container/network cleanup. No access rule was weakened.

## Risks and boundaries

- Newsletter Studio retains its existing single-company HTTP guard. The integrated Command Center job-health refresh still inherits that restriction until PR #400 finishes its final gate and merges. Direct scoped-service evidence does not qualify the broader module for multi-workspace HTTP use. This is an explicit feature dependency before broader newsletter owner testing.
- Whole lifecycle activation remains disabled. Newsletter notifications and other email/referral/social/AI/provider families need their own admission and settlement qualification alongside their features.
- Hosted Neon/Vercel/CDN parity and complete Helios/second-company compatibility remain release dependencies. Synthetic PostgreSQL/Next proof does not close them.
- Vercel connector inspection returned 404 for both known project IDs under the known team. Live Vercel bot comments on #396, #398 and #399 report two skipped/ignored automatic deployments. Settings were not changed. No newly qualified hosted owner-testing URL exists.
- Shell is default-off with an explicit workspace allowlist and current OWNER/ADMIN access. It summarizes persisted module data, not verified live provider health.
- No production changes, billing, real external onboarding or provider activation occurred.

Standing authorization: continue reversible non-production implementation, tests, staging qualification, qualified merges and next milestones without routine permission. Owner-only stops remain production, destructive/irreversible operations, consequential security/architecture choices, billing, real external onboarding and material unexpected risk.
