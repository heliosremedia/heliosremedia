# Studio V2 live recovery checkpoint

Updated October 9, 2026. Production ON HOLD. Resume from live GitHub, not interrupted local files.

## Verified integration

Branch: `codex/v2-hosted-access-owner-action`.
Latest verified application integration: `668e8b934e941d4c7cbd5ada8c544b2826b3b30f` (PR #405).
Tree: `cda080ab55887dd1cb8b3e83b78270b3e0d4662e`, independently verified equal to qualified candidate `e419f205ed6686590ac805a29c4e6b6520c3ebde`. Fresh live recovery and post-merge tree verification completed October 9.

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
| 11582716612 | `9c39efa5a3dd139d1aadfbc65da35bf3135a0d0a` | `29b7beb050bcde8d2c831b89c9c288051e793b9105ac8a84aee233418ab59ab7` |

Screenshot artifacts: 11581027188 (`69819f6722336a75ade93ad19b8d5abe839b71e88ceb63d42b105838ed0d058a`) and 11580952281 (`b2b0013e5a03d4597c78686d1a9136cd0b7f59b2b7e72fc5058d3fdd5eae9bbe`). Mobile and desktop images inspected. Inspection found and corrected global link-reset interference with primary action contrast; a computed-color browser assertion now guards it. Local Chromium installation failed with an invalid downloaded archive; browser passes come from CI.

## Active work and immediate next action

Recovery completed from live GitHub under the project-lead direction in PR #401, comment 6072876581. PR #400 is integrated. Its regression 37852201803 (1,847 tests, TypeScript and all Chromium) and runtime 37852201829 remain successful for the unchanged exact candidate. Runtime artifact 11582716612 was independently verified in the prior session; cleanup and schema/access restoration were verified. No mutating or hosted operation was replayed.

The remaining screenshot gate is complete: independently downloaded artifact 11582228840, matched ZIP SHA256 `79af4e2da5cfa31e2fbed69113a471fe40c74b9bfbc4529c1a913671f302ffe0`, and inspected all four Command Center/date-dialog images at 390px and 1440px. Text and controls are readable with no clipping. Both prospective and integrated trees equal the qualified candidate. No duplicate full qualification was run.

PR #399 screenshot artifact 11582811831 was independently verified against SHA256 `06d6d15b194d6fc984f54c2fa6aa2471dff2a95923dd04e2cc078bcd12d197e1`; mobile and desktop dialog images were inspected.

PR #400 supplies a separate GET-only Studio job projection using current-session, explicit workspace rollout and existing locked owned-service admission. When the original newsletter module is unavailable, the panel explains this and hides edition-action links. No send, retry, replay or provider action is introduced.

Documentation integration #401: `52fd4aa841c1b8d098ceaa9819f58f0bfd20622f`, tree `d78122a094437a646ae78b472462f0550d9ebff3`. Application tree is unchanged from #400.

**Integrated PR #402:** workspace Media Library discovery, owned search/counts and project summary totals, useful empty states and selected-project media links. Regression 37875470156 passed 1,849 tests, TypeScript and all Chromium; runtime 37875470208 passed. Runtime artifact 11592371076 SHA256 `54cacb337cb10dbf73f1edb315aeb29016fb7fbd08d6ad03a8eb89a9a5a2535b` independently verified against exact candidate `b1a7da768047e566a9cd3a198cdad749495357ce`. Screenshot artifact 11592516268 SHA256 `0caa16d7183b221c61ade39ace18027ec2f6669b47437936f4f58328e225b834` independently verified and four 390px/1440px empty/selected library images inspected after contrast repair. Prospective and integrated tree `8a914aac0373dadf1550ee73a4615eac04656a8e` match.

**Integrated PR #403:** project-detail revision and draft recovery at `1da8b92d613fc690aa41f5d89bdcb1ab4b0d1442`, candidate `8b087e716d0908e5d6e3363ddea93431333b1f0b`, tree `e09311fd67aa16f20a738737f4d3a507d4f30d43`. Regression 37877050911 passed 1,851 tests, TypeScript and all Chromium; runtime 37877050907 passed. Runtime artifact 11592578372 SHA256 `2ff41aafd29ed6addae8b0f3c76d06e07079be8c9afeb116c6b9f43eedd581fb` independently verified: exact candidate, both-company concurrent saves/stale replay, six observed database waits for viewer/revoked/suspended actors, schema and access restoration. Screenshot artifact 11592912735 SHA256 `2e828c38dffdf7e19684c52bb72383a7e9e7a26100f52b14d5341fb1f81ea279` independently verified and all four editor/conflict 390/1440 images inspected. Two visual repairs addressed fieldset overflow and intrinsic label sizing; dialog and section-width assertions now guard them. Prospective and integrated tree equality verified.

**Integrated PR #404:** private draft creation at `7663357fccb7c29205a9f4571d7801392827d119`, qualified candidate `d19fb77a7c64203debf752e96e44f6155dcb1f56`, tree `e8ffbe6537d0cacb4b72e47c5cac27ceda001377`. Stable workspace/actor/submission identity prevents duplicate drafts on replay. Controlled fields survive validation/transport failure and uncertain creation pauses for review. Regression 37878780902 passed 1,854 tests, TypeScript and all Chromium; runtime 37878780903 passed. Independently verified runtime artifact 11593158139 SHA256 `0077305eb61492dc4769606a63dfe2be6cc621f033da709f86896a670f4d1fce`: exact candidate, actual Next Server Action, both-company owned creation/replay, six lock-observed access changes without creation, schema/access restoration. Screenshot artifact 11593712564 SHA256 `a006720ed69fbf319700771bae811ccfd3cc98ab50f0f62f50c33e5776ba6760` independently verified and 390/1440 forms inspected after explicit-label and grid-width repairs. Prospective/integrated trees match.

**Integrated PR #405:** reviewed media metadata editing at `668e8b934e941d4c7cbd5ada8c544b2826b3b30f`, qualified candidate `e419f205ed6686590ac805a29c4e6b6520c3ebde`, tree `cda080ab55887dd1cb8b3e83b78270b3e0d4662e`. Existing metadata and quick-visibility actions submit the reviewed media revision, reject stale writes under existing owned locks, preserve drafts after uncertainty and pause metadata saves until explicit review/reload. Regression 37878801425 passed 1,856 tests, TypeScript and all Chromium; runtime 37878801344 passed. Independently verified runtime artifact 11593976131 SHA256 `2c8deafa918f8839ae36e1be5f40ff742ed8876c060be36a0c34ca083aaf2c6e`: exact candidate, both-company concurrent single-winner/stale replay, all 12 lock-observed authorization/service/asset races without mutation, hero rollback, registry and legacy compatibility, schema/access restoration. Screenshot artifact 11593263210 SHA256 `cccfee7dfd48508381c8902604ac8b997cc89c9ea676c3b13ad7d1837aa4462b` independently verified; four 390/1440 editor/recovery viewport images inspected, including scroll-reachable recovery actions and cancelled reload preserving the draft. Prospective/integrated trees match. No schema/provider activation.

Draft runtime fixture repairs: 37875726925 incorrectly assumed a progressively enhanced form action marker; 37875888470 exposed mismatched synthetic origin/forwarded-host headers. The fixture now uses the actual compiled Next action identity, installed Flight encoding and matching synthetic headers. Existing Next origin protection is unchanged. Failed-run logs confirmed container/network cleanup; successful current run supersedes failed candidates.

**Active milestone and next safe task:** validate and improve Projects and Media create/edit workflows under the Studio shell using synthetic owned records and existing upload/provider containment. Reviewed per-asset metadata editing is now integrated. Next, exercise the owner path from a new private draft through media additions, service assignment and review using synthetic owned records and the existing provider containment. Resolve demonstrated workflow defects alongside that capability; bulk move/reorder/delete retain their existing separate contracts. Do not claim complete owner readiness until hosted access and this full workflow qualify. Preserve storage/provider containment; do not add speculative upload or provider rewrites. Maintain the existing owner-testing guide and this checkpoint. Do not add speculative hardening packets or parallel continuity systems.

Recovery overhead: one fresh clone, live reads of both PRs and project-lead comments, exact-head CI and integration verification, and one 445,661-byte screenshot artifact download. No test suite rerun or hosted operation replay was required. Exact recovery wall time was not instrumented. Later qualification reruns followed actual code or fixture changes (contrast, dialog sizing, Server Action transport), not reconnects. No hosted or mutating operation was replayed due to recovery. GitHub checkpoints do not restart Work sessions; autonomous progression occurs only while an execution session is active.

Initial schedule-runtime failures were qualification assumptions: 37850304377 expected route-level 403 instead of proxy 401; 37850807028 attempted positive newsletter HTTP with two workspaces despite the existing module hold. Corrected qualification setup; failed-run logs confirmed container/network cleanup. No access rule was weakened.

## Risks and boundaries

- Newsletter Studio retains its existing single-company HTTP guard. The integrated Command Center has separately qualified read-only status for two workspaces; edition actions retain that restriction. Direct scoped-service evidence does not qualify the broader module for multi-workspace HTTP use. This is an explicit feature dependency before broader newsletter owner testing.
- Whole lifecycle activation remains disabled. Newsletter notifications and other email/referral/social/AI/provider families need their own admission and settlement qualification alongside their features.
- Hosted Neon/Vercel/CDN parity and complete Helios/second-company compatibility remain release dependencies. Synthetic PostgreSQL/Next proof does not close them.
- Latest read-only Vercel inspection confirmed the team but returned no Helios project for repository/search queries and 404 for the known staging project ID. Earlier inspection also returned 404 for the production project ID. Live Vercel bot comments on #396, #398 and #399 report two skipped/ignored automatic deployments. Settings were not changed. No newly qualified hosted owner-testing URL exists.
- Shell is default-off with an explicit workspace allowlist and current OWNER/ADMIN access. It summarizes persisted module data, not verified live provider health.
- No production changes, billing, real external onboarding or provider activation occurred.

Standing authorization: continue reversible non-production implementation, tests, staging qualification, qualified merges and next milestones without routine permission. Owner-only stops remain production, destructive/irreversible operations, consequential security/architecture choices, billing, real external onboarding and material unexpected risk.

Visual inspection of the initial #402 screenshots found faint inherited supporting text. Corrected the library and project editor text contrast before merging; new exact-head qualification replaces the earlier candidate evidence. Initial #402 runtime artifact 11591947695 (SHA256 `d16446ab4ab917444d3e83cc6ce64af66097067c287400069b9b76efcd313a1c`) and #403 runtime artifact 11592375185 (SHA256 `36879fb40c727e4d324776a79d16bd85003e5adb7daa0f58e28e2b3f7a9e2e33`) were independently verified but do not qualify later modified candidates.

## Qualification corrections and execution recovery (historical)

The execution service disconnected and the previous scratch worktrees disappeared. All application changes had already been committed to GitHub. A second fresh shallow clone recovered integrated #403 into a new transient directory; no hosted or mutating action was replayed. The execution service subsequently disconnected again and recovered. Connected GitHub operations preserved continuity throughout. Fresh clone `/tmp/helios-recovered` was used for subsequent tree checks; do not assume any transient paths or installed dependencies survive.

Prior #404 candidate ae7fb17cb12bcc272ffe7630b25583ed67d076e8 passed 1,854 tests, TypeScript, Chromium (37877911267) and isolated runtime (37877911289). Runtime artifact 11593176893 SHA256 c1ea52cf4fba8bc4a65eb825d9d0fd7c1d3b2e2772c000b29184ecbf0a89cdd2 was independently verified. Screenshot artifact 11593606235 SHA256 165a6eee96ea0f68c43deb60f6945c010e6f033539520c8a4418d69dd57d261d was independently downloaded/hash checked and mobile/desktop images inspected. Inspection found mobile grid content exceeding its available width despite the document-level check. Current d19fb77a7c64203debf752e96e44f6155dcb1f56 adds explicit zero-minimum single-column grid tracks and shrinkable field wrappers, plus form/section geometry assertions. Require its new exact-head gates before merging.

Prior #405 candidate 72df87c5003c6fc3699140b30a8923ead725b1b5 passed regression 37877945654 and runtime 37877945647. Runtime artifact 11593850156 SHA256 46f0ec7d6ad432bf60c926b537e097fe869471a69d58d5a5397ed1d38ee9baab independently verified exact candidate, both-company concurrent single-winner/stale replay, all 12 database-observed permission/service/asset races, hero rollback, legacy compatibility, schema and access restoration. Screenshot artifact 11593600582 SHA256 8407c14983c58ea1644d983ade1184b4aebb6c2a197a8fabdc2fb59058ba1211 independently verified and both metadata-dialog images inspected. Current e419f205ed6686590ac805a29c4e6b6520c3ebde inherits the creation-grid fix and adds viewport screenshots with explicit scrolling/cancelled reload checks to prove mobile recovery controls are reachable. It is not yet qualified.

Current resumption: #404 and #405 gates are complete and both are integrated as recorded above. PR #406 reconciles only the existing checkpoint, roadmap and owner guide over the qualified application tree. Verify the current live branch and proceed to the owner workflow described above. Do not rerun completed evidence merely because execution disconnected. Production remains ON HOLD.\n