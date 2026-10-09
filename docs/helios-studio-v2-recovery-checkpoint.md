# Studio V2 live recovery checkpoint

Updated October 9, 2026. Production ON HOLD. Resume from live GitHub, not interrupted local files.

## Verified integration

Branch: `codex/v2-hosted-access-owner-action`.
Latest verified application integration: `1da8b92d613fc690aa41f5d89bdcb1ab4b0d1442` (PR #403).
Tree: `e09311fd67aa16f20a738737f4d3a507d4f30d43`, independently verified equal to qualified candidate `8b087e716d0908e5d6e3363ddea93431333b1f0b`. Fresh live recovery and post-merge tree verification completed October 9.

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

**PR #404:** recoverable private project creation, current candidate `ae7fb17cb12bcc272ffe7630b25583ed67d076e8`, tree `63e032a601871ca293281657b19ecb1b0a37060c`, retargeted to integration after #403. Stable workspace/actor/submission identity prevents duplicate drafts on replay. Controlled fields survive validation/transport failure, with explicit review after uncertainty. Prior candidate `1b1d50a37a8a0c7a5c57331507371dad6ac7b731` runtime 37877076514 passed. Artifact 11592144470 SHA256 `9cbbc0c35e40414eb0604bc6e2fe07fbe5d11756b09382664b38c7063cd63ab4` independently verified: real Next Server Action, both owned drafts and replays, all six lock-observed access changes without creation, exact candidate, schema and access restoration. Regression 37877076452 passed 1,854 tests and TypeScript but failed the final creation browser check: its exact textarea label changed after validation recovery. Current candidate separates an explicit label from the textarea. New exact-head runtime/regression, independent artifacts and final screenshots are required; earlier runtime evidence does not qualify the modified candidate. No schema, provider or publishing activation.

**Active PR #405:** `codex/v2-studio-media-editor`, based on #404, current candidate `72df87c5003c6fc3699140b30a8923ead725b1b5`, tree `f9f9e1d1ee696e9737b1a40e7fe2c8b1e12e0e47`. Implements reviewed media metadata revisions, monotonic version advancement and preserved drafts with paused resubmission after conflict/uncertainty. Focused tests (including existing registry ownership), local TypeScript and scoped lint pass. Extended two-company concurrent/stale-replay runtime and actual-component responsive browser gates are running. Require exact-head evidence, independent artifacts and screenshots before merge. This is not integrated or owner-qualified yet.

Draft runtime fixture repairs: 37875726925 incorrectly assumed a progressively enhanced form action marker; 37875888470 exposed mismatched synthetic origin/forwarded-host headers. The fixture now uses the actual compiled Next action identity, installed Flight encoding and matching synthetic headers. Existing Next origin protection is unchanged. Failed-run logs confirmed container/network cleanup; successful current run supersedes failed candidates.

**Active milestone and next safe task:** validate and improve Projects and Media create/edit workflows under the Studio shell using synthetic owned records and existing upload/provider containment. Next observed dependency: media metadata updates serialize writes but do not submit a reviewed media revision, and transport failure permits a blind retry. Complete reviewed metadata editing and draft recovery alongside the existing media UI before claiming the full create/edit milestone. Preserve storage/provider containment; do not add speculative upload or provider rewrites. Maintain the existing owner-testing guide and this checkpoint. Do not add speculative hardening packets or parallel continuity systems.

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
