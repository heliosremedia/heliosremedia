# Studio V2 recovery checkpoint

Updated October 13, 2026 (UTC). **Production ON HOLD.** Live GitHub is authoritative. This is the single current continuity record; historical evidence remains in the progress ledger and [prior checkpoint](https://github.com/heliosremedia/heliosremedia/blob/e0f57719355a03a3e63918928173c6697f01d813/docs/helios-studio-v2-recovery-checkpoint.md). The owner's continuous-development directive supersedes the earlier temporary feature pause.

## Current status — October 13, 2026, 11:39 MDT

**Persistent synthetic-owner login and current-source staging Preview are now live-qualified.** Protected run [38417689573](https://github.com/heliosremedia/heliosremedia/actions/runs/38417689573) completed successfully after actual owner review. This section supersedes historical waiting, missing-password and no-testing-URL statements below. Production remains ON HOLD; provider activation, real tenant onboarding and First Light are not qualified.

- Application source: 2f890c32d6ba627e3af49c294f15b7fb61773394 (#441). Executor: 9e7dcfc4611ed21e19d7fc1b7a42ff1da109c68d (#442). Only later documentation differs from the current application source.
- qualify_current job 115366401234 passed all steps, including 41 credential-free policy tests, native Preview/ordinary owner qualification and independent suppression restoration. Historical qualify/inspect were skipped. No migration or credential initialization was repeated.
- Artifact 11834213587, staging-current-owner-preview-38417689573-1, independently downloaded; SHA256 3f5e3b91606d01bdea366aa03c93d7fa18ddaf5d1039a009ebfcdbd9039e98e9 matched GitHub metadata; ZIP CRC passed; current-owner-preview.json inspected. success:true, ownerAccessQualified:true, failures:[], persistentHostnameBindings:true.
- READY Preview dpl_5kwK1bUf2ZasbbB8WhsSsPjFmEt2 belongs to exact existing staging project/team and source. Checksummed native build receipt checksum 1d64f57e0672404e83d4e4ad8b48778b023fe96e6133ccf207b06211c8b984b0; buildDigest 3d7f24aea54deafcee3a25a965a12fa33983bc9e462bd4b325a105ee99386dc9. Before/after current schema 9a0c9c3ca2796e8f4c640c652e51fd0c7132bd30b8f59ab5e755327009ba8d3f and ledger c180e1f22e689cdff0598a535176443b3ba37eefe25e07e77354226534ff89e8 match.
- Both owners used actual ordinary LoginForm/password flow, reached Command Center, refreshed at 390/1440 widths without page errors/overflow, read own media (200), rejected foreign media (404), rejected the other owner's password (401), logged out and signed back in with persisted passwords. External browser requests:0. Postflight validates only allowed hostname/auth-metadata/audit transitions; existing credentials/unrelated data/schema/ledger preserved.
- Run-owned temporary Preview configuration removed, automatic builds suppressed again, verified hostname bindings retained. The deployed configuration retains its captured auth/database settings; no production configuration changed. The receipt's coarse events reason labels classify sanitized log text and are not lifecycle failures; failures is empty and every admission/qualification/cleanup gate passed.

| Workspace | Email | Password | Verified testing URL |
| --- | --- | --- | --- |
| packet16-a | packet16-a@example.test | Owner's saved STAGING_OWNER_PASSWORD_A | [Company A](https://helios-v2-staging-kou4v5ib4-helios-real-estate-media.vercel.app/login?next=%2Fadmin%2Fstudio) |
| packet16-b | packet16-b@example.test | Owner's saved STAGING_OWNER_PASSWORD_B | [Company B](https://helios-v2-staging-git-codex-v2-ba2354-helios-real-estate-media.vercel.app/login?next=%2Fadmin%2Fstudio) |

Vercel Deployment Protection remains enabled. Independent unauthenticated URL checks reached Vercel sign-in, as expected; users must authenticate with their existing authorized Vercel account before ordinary application login. Hosted qualification used the existing configured testing credential, not disabled protection or minted app sessions. Do not expose passwords/bypass credentials or broaden access controls. No testing URL contains a secret.

Recovery tooling: prior local worktree path was missing (-32603 No such file or directory); GitHub source reads worked and scratch Python independently verified the artifact. Vercel connector deployment listing returned 403 Forbidden for the exact team/project; local Vercel CLI absent. No unchanged retries or scope changes. GitHub protected runner's separately configured provider credentials completed all live gates.

Next: owner can inspect this qualified synthetic Studio using the retained links. Continue ordinary reversible non-production product work from live integration, keeping this Preview's source provenance explicit and preserving existing controls. Do not recreate infrastructure, rerun completed migration 38336325763, replay credential initialization 38416979449, or duplicate this successful Preview run. Current qualification establishes hosted access, not full-product completion or real-company onboarding.

## Verified integration

Latest staging dependency integration: PR #437 at `f1d58c8061be4706b7a6a716e217a14afafb3e57`, post-merge tree `9e53cf8f522a03e352d974f5a138a961e2b66fa0`. Qualified execution source `963d33ee9858d6a4d5b4f60131b4b6e07db4a79d`, tree `458785c77d0fb03c4651712d17b3a4754f740d79`; final head `831e36b31460278d5a71f5a165d11f4f55f68bed` differs only in this checkpoint, verified by GitHub comparison. Prospective/post-merge trees match. #434/#435 added exact schema admission and the rehearsed upgrade runner; #437 fixes UTF-8 source validation and qualifies current-source hosted builds. The six reviewed migrations have now been applied to live staging by completed run 38336325763; independent receipt verification is recorded below.

Latest product integration: PR #433 merged at `90091c7a2434e1d86fca99b19051f75d7f4ce9cf`, candidate `ef4dd7dbf3b95028efae8a6c4925fde2096f917e`; candidate/prospective/post-merge tree `c51398d0f853305450d5463bec80a617b262c7a5`. Exact-head regression `38328449162` passed 1,860 tests, TypeScript and all Chromium. Artifact `11782058389` independently downloaded, SHA256 `f2431dd523f14bba30056a79fcd798203fbf33a56db12c1f54a5ce6d27196df5` matched metadata, ZIP CRC passed. Phone/desktop login recovery and phone pending screenshots inspected. Sign-in now prevents duplicate pending submissions, retains fields after failure, provides readable connection recovery and stays locked during acknowledged navigation. No backend auth/session/schema change; #432 actual-server login evidence reused.


PR #432 merged into `codex/v2-hosted-access-owner-action` at `3ecb648b30645fd9f9c16d8fe16537ed26c6dba7`. Qualified candidate `b9e46c56ae047cab3f1a48b1d9a5884237c7f079`; candidate, prospective merge and post-merge tree all `1c2220359f2b2db0151542b3ae583437698fff57`. #430 integrated at `5bf220625c3d7cd6520146d325c64beaee39e933`; #431 at `20a2d61d41c14ca59cc2331c3ffce332cf248352`.

The documentation commit carrying this checkpoint follows that merge without changing application/test/runtime source. Check live HEAD for it or newer work before acting. No unfinished implementation is left on these three PRs. Post-merge regression `38191421425` passed on `3ecb648b30645fd9f9c16d8fe16537ed26c6dba7`; verified again October 13 UTC without rerunning it.

Protected executor: `codex/v2-neon-staging-bootstrap` is `8c1fb12dd79f37f0ad5e7e727699fd0f2c59b926` (#438), tree `6d199661f4d8732e4d3ffb6b06baf863f5e5e0a7`. Candidate `14b3a9a52564ee4ba4f83682668d6c9f22f52979` passed contract `38335290415` and regression `38335290408` (1,572 tests, TypeScript, configured Chromium); candidate/prospective/post-merge trees matched. This workflow pins corrected source 963d33e and its exact successful run IDs. The executor regression emits no artifact; no application UI changed. Existing environment review/no-admin-bypass, ready/target/TLS and non-production restrictions remain. Do not merge this executor's older application baseline into integration.

## Usable product progress

The integrated application supports workspace-aware navigation and Command Center, private project creation/details, registered synthetic media, reviewed services, private review/revocation, reviewed publishing/featured placement, unpublish/archive/private restore, and responsive project browsing/order recovery. Tenant, revision, authority, consent and uncertainty protections remain.

- #429: Command Center schedules and snapshot times use the viewer's local timezone. The Playwright timezone correction was already integrated on recovery.
- #430: inquiry follow-up inputs preserve local wall-clock time; workflow failures appear in the correct styled modal.
- #431: unsaved private notes remain with their inquiry across navigation; late responses preserve newer typing and other inquiries' drafts. Drafts are component memory only, not durable across reload/logout.
- #432: the existing actual Next/disposable PostgreSQL owner flow now begins with an inquiry. Both synthetic companies sign in normally, use owned prefill, reject foreign inquiry page/action access without mutation, create/replay exactly one project and activity link, and continue through details, synthetic registered media, services, private review and logout. Inquiry contact/message data stays out of project fields. Fixture cleanup and existing credential/audit/schema restoration pass.

These are isolated qualification results. **No current owner-testing URL, hosted persistent login, live provider readiness or First Light is qualified.**

## Qualification and independent evidence

| PR | Qualified candidate | Regression | Runtime / scope |
| --- | --- | --- | --- |
| #429 | `749362c732ab4cc4ba89504a4446a80a3741658b` | `38185526522` | Display-only; existing runtime evidence reused |
| #430 | `99beae0cffd48aa18e8eea7aae8f91076338bf13` | `38188450047` | Display/error state only |
| #431 | `b617e93ce52596bb8262c613968cef0d0bf8928e` | `38189332657` | Component draft state only |
| #432 | `b9e46c56ae047cab3f1a48b1d9a5884237c7f079` | `38190803695` | `38190803685`; actual HTTP/Server Action on disposable PostgreSQL |

Final #432 regression passed 1,860 tests, zero failures, TypeScript, every configured Chromium step and whitespace validation. Final runtime receipt identifies the exact candidate, disposable-local-postgresql, two passing tenant flows, actual HTTP/Server Action, unchanged columns/indexes and restored synthetic access. Inquiry/activity cleanup assertions execute before receipt emission. Receipt reports hosted:false, deployable:false and no live provider calls. Final 390/1440 note images were visually inspected; they show the saved note and retained newer draft.

| Artifact | Independently verified ZIP SHA256 |
| --- | --- |
| #429 `11720060362` | `6cdf69db348255686c8a3cdf59a096cd6df2c718369335d7cfeb6f546ef8eb82` |
| #430 `11721310293` | `775a50e5f520c6eb9c93a43a39cad3147075930facea9e01c53f76670da469a7` |
| #431 `11721221056` | `d653c27a36a2219b50e7cf386fd92a39542ee1ac7230afdec8d7b220f70d08ee` |
| #432 runtime `11721493108` | `e43b8cb54b3749a531e093d699d2918fe251fc900779ca5a05919e84d7c75194` |
| #432 screenshots `11721578504` | `b27db9ae4f3c54579b7b71c878dd2560255c5ddada6f10eb772bce21c08d6bd5` |

Every listed artifact was downloaded independently, checked against GitHub SHA256 metadata and ZIP CRC, and inspected for its relevant evidence. #429 Command Center and #430/#431 inquiry phone/desktop images were visually inspected. #430's full-page fixed-modal capture included below-viewport document space; #431 corrected modal captures to viewport-only.

Earlier #426/#427 artifacts `11695947503` / `11696860148` were independently verified in the prior checkpoint (hashes and inspected files retained there). Their unstyled inquiry fixtures did not establish real modal presentation; #430/#431 add application CSS and viewport checks. #432 adds continuous actual-server inquiry handoff evidence. Hosted qualification is still outstanding.

## Failures resolved and reuse limits

Initial #432 candidate `2e8f7e6aeea035930a71d2541fb42fb1569d6a2b` passed runtime `38190115077`; artifact `11721357269`, SHA256 `5b9a80ae1440e348a1bc0d3e2afb313197767b0641a04b0824e2f3566625602c`, independently checked. Regression `38190115054` then exposed a browser-test race: a text locator could match the textarea before acknowledgement. Follow-up deliberately holds the save, verifies retained pending text, releases it, and waits for a saved paragraph plus cleared input. Application/runtime source did not change. Final exact-candidate CI supersedes the failed run.

No successful historical suite was rerun just for recovery. New source commits triggered established CI; corrective qualification resolved demonstrated defects. Documentation-only checkpoint commits reuse unchanged code evidence. Historical stacked draft PRs are not the maintained integration line; do not merge/replay them blindly.

## Owner-accessible staging: inspected baseline; upgrade/login work remains

Read-only inspection [38329475195](https://github.com/heliosremedia/heliosremedia/actions/runs/38329475195) completed after Jake's environment approval on exact executor `b78600b3080dfa97dc263b13c2fca6bae30bf158`; inspect succeeded and qualify/deployment was skipped. Artifact `11782996723` independently downloaded; SHA256 `b966bd893c5638400c6c42001c53cf4cb897c3dddf8bc338903fccb5b30ef666` matched GitHub metadata; ZIP CRC and receipt identity inspected.

Observed 2026-10-13T01:14:53.165Z: Neon branch currentState `ready`; exact expected project/branch/database. Database schemaHash `500be0f2b2b62093876525ee61994200aa822fefd7f47e41dfffdba6ec0f7dad`, ledgerHash `d6880a84f947ea721b006264466857fb7ad1649f2830b14853b360409386c4ce`; 19 ledger entries, 0 unfinished, 0 rolled back, 2 workspaces, 2 projects, 0 active owners with stored passwords. Transaction was read-only. Both Vercel default and expected-team scopes returned 200 with expected project/team, connected Git and automatic builds suppressed. Receipt deployable:false and ownerAccessQualified:false. No settings/migrations/deployment changed.

The live schema hash matches the independently pinned historical staging catalog. Existing #415 rehearsal artifact `11672438840` was recovered without rerunning: SHA256 `ce7cd03e3bacb03f75c246875f321f035feb621faa262733550f2f9d29aa927c`, ZIP CRC passed. It binds six unchanged migrations from the 19-entry baseline to expected current schema `9a0c9c3ca2796e8f4c640c652e51fd0c7132bd30b8f59ab5e755327009ba8d3f`, with original ledger/data retained, Prisma equivalence and repeat no-op. Live aggregate counts/hash alone do not verify individual ledger checksums; the eventual executor must revalidate every row before mutation. Persistent password setup and current-source Preview admission remain incomplete. Do not recreate or restart infrastructure.

Existing targets:
- Vercel `helios-v2-staging`, project `prj_PUv0ADGxYl5QjRYaMv2h8Km1UmMg`, account `team_H79eaUfq9xMqcbf34ZCtwwn9`. Earlier connector scope selectors had empty/404 responses; the October 13 protected inspection returned 200 and matching identity in both default and expected-team API scopes. Do not recreate it.
- Neon organization `org-nameless-shape-94202911`, project `calm-shape-83359560` / `helios-v2-staging`, branch `br-young-math-arj7l4r3` / `main`, database `helios_v2_staging`. Jake's earlier other-email/org screenshot was a different project; it did not prove deletion.
- Preview build suppression and environment protections are intentional. Historical September hosted source is not the current Studio application.

## Next safe gates

1. Inspection `38329475195` is complete and independently verified. Do not replay it. Its historical observation was the old schema with no active owner having a stored password; completed upgrade 38336325763 supersedes its schema observation.
2. #434/#435 qualified exact schema/ledger admission and the real upgrade runner on disposable PostgreSQL. #435 regression `38332366975` passed 54 new policy/invocation cases, 1,860 existing tests, TypeScript and all Chromium; rehearsal `38332366928` passed preservation, six executed migrations, Prisma equivalence, repeat no-op and failure/drift/concurrent/already-current rejection.
3. #436 is integrated on the protected executor. Upgrade run [38333803845](https://github.com/heliosremedia/heliosremedia/actions/runs/38333803845) was dispatched once, then cancelled while waiting for review after final code review identified a Buffer/text checksum mismatch in its pinned source. GitHub confirms upgrade_current cancelled and legacy rehearsal skipped, both with no job steps. No live migration ran.
4. **Do not approve, rerun or redispatch either upgrade run.** Corrected run [38336325763](https://github.com/heliosremedia/heliosremedia/actions/runs/38336325763) completed successfully at 2026-10-13T02:48:39Z on executor `8c1fb12dd79f37f0ad5e7e727699fd0f2c59b926`. Its `upgrade_current` job 115097118025 executed successfully, including the six-migration step; historical rehearsal was skipped. Existing protected review was honored. No further owner approval is needed for this completed operation.
5. Artifact `11786685444`, `staging-current-upgrade-38336325763-1`, was independently downloaded on recovery. ZIP SHA256 `9926638e87aafe9ffc4eaf13aeed746e15333f242953c7c4d7211e99dfee4231` matches GitHub metadata; ZIP CRC passes. `current-upgrade-live.json` pins candidate `963d33ee9858d6a4d5b4f60131b4b6e07db4a79d`, exact executor and existing Neon project/branch/database/organization/region. Observation 2026-10-13T02:48:34.030Z records baseline 19 entries and current 25 entries, schema `9a0c9c3ca2796e8f4c640c652e51fd0c7132bd30b8f59ab5e755327009ba8d3f`, ledger `c180e1f22e689cdff0598a535176443b3ba37eefe25e07e77354226534ff89e8`. Existing ledger rows/data preserved, six migrations added, no implicit enrollment, no automatic repair, repeated deploy no-op. Receipt explicitly has hosted:false, deployable:false, ownerAccessQualified:false. This verifies the completed upgrade, not current database state after subsequent operations.
6. Current-source hosted build admission is isolated-qualified by #437. Persistent owner login and current-source Preview execution/configuration are still incomplete. Existing legacy hosted qualification restores temporary hostname/configuration changes, so historical success did not leave a persistent owner-testing URL. Continue the current-source persistent owner setup and protected Preview path after verified schema upgrade, retaining existing provider restrictions. Do not recreate infrastructure.

#434 rehearsal artifact `11782518764`: SHA256 `2f423c5c25cfe65684d1ca0e90d143fcea5efb0747bf498ddc154df5c8c0f05e`; regression archive `11782899227`: `3c70d42898e1eb27ae3497039f867f125201ee8486bd63570a28ecd9e326a653`. #435 rehearsal `11782914230`: `202c96f99a67c17b85e43fcfce01208bcdf76043cd391603b6848ff78144aab3`; regression archive `11783219953`: `6cce0a01322b0e923d075fbcacff342825fde5e90bf63597099a4863d5d145f7`. All independently downloaded, compared with GitHub SHA256 metadata and ZIP CRC checked; runtime receipts inspected. UI is unchanged; prior responsive visual verification is reused. The ancestry-only #435 reconciliation changed no bytes and did not rerun expensive suites.

Completed inspection inputs (historical record, not an instruction to redispatch):

| Inspection input | Exact value |
| --- | --- |
| Branch/ref | `codex/v2-neon-staging-bootstrap` |
| executor_sha | `b78600b3080dfa97dc263b13c2fca6bae30bf158` |
| inspect_only | `true` |
| confirmation | `calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging` |
| candidate_sha | `inspection-only` |
| hosted_confirmation | `read-only-inspection` |

The sentinels cannot admit deployment. Inspection uses provider GETs and a read-only database transaction/rollback only if the ready guard passes. No provider activation, real customer onboarding, billing, destructive operation or production change is authorized. Production remains ON HOLD.


## Cancelled upgrade dispatch inputs — do not replay

| Input | Value |
| --- | --- |
| Branch | `codex/v2-neon-staging-bootstrap` |
| executor_sha | `89b69ca787f68641be5e9fb1d67a49f834e931c6` |
| candidate_sha | `f38e5e544e47f02891626395f79c80c9eae5eb1d` |
| track | `current-studio-upgrade` |
| confirmation | `calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging` |
| upgrade_confirmation | `upgrade-six-reviewed-migrations-only` |

## Current qualification and handoff

#437 final regression `38334991100` passed 59 migration policy/invocation/source tests, 1,874 existing/current-profile tests, TypeScript and all Chromium. Actual PostgreSQL six-migration preservation/repeat rehearsal and actual Next build `38334991003` passed. Runtime artifact `11784283858` independently downloaded, GitHub SHA256 matched `2ad0d99f3921d91f80491a4f5a01f87bd00760b7d899960b2a4058f1c3d9d618`, ZIP CRC passed and both receipts inspected. Regression archive `11784531542` SHA256 `415723735745fa0e09774931ebf8df8ee936611f096ce2337c6ba567af37f756` independently matched/CRC passed (57 files). UI unchanged; earlier responsive visual evidence reused.

Build receipt explicitly uses synthetic provider metadata, isolated-synthetic-provenance, deployable:false, promotable:false, hostedQualification:false. Current catalog `9a0c9c3ca2796e8f4c640c652e51fd0c7132bd30b8f59ab5e755327009ba8d3f`; source Prisma schema `892bb7f73b39e0fce20321557a3b09273a436b56b8b7f94b353e93eefe820224`; isolated buildDigest `34b5d7f4fef7d1577e66d4bbfa5602d31bd33aacfc3395a96c38bb5ef511c3cb`. These do not prove live owner access.

Resolved defects: initial #437 test harness extracted an obsolete source callback; tests now exercise the actual shared source helper, preserve historical negative cases and retain the original legacy runtime fingerprint through exact reviewed normalization. Final review found Buffer reads were JSON-serialized by inspect.hash. Shared live/rehearsal file validation now explicitly reads UTF-8; actual-file acceptance and migration/history/manifest/directory tampering are tested. No expected migration checksum was weakened. Old waiting run cancelled before steps; corrected source reran required qualification because execution changed.

Replacement run inputs (already dispatched; do not duplicate):

| Input | Value |
| --- | --- |
| Workflow | `v2-neon-staging-bootstrap.yml` |
| Branch | `codex/v2-neon-staging-bootstrap` |
| executor_sha | `8c1fb12dd79f37f0ad5e7e727699fd0f2c59b926` |
| candidate_sha | `963d33ee9858d6a4d5b4f60131b4b6e07db4a79d` |
| track | `current-studio-upgrade` |
| confirmation | `calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging` |
| upgrade_confirmation | `upgrade-six-reviewed-migrations-only` |

Current integration code SHA `f1d58c8061be4706b7a6a716e217a14afafb3e57`; recovered live HEAD before this documentation correction was `1f5068a08e529b4ea58c8c77a231f01a2dde3229`. All implementation through #438 is committed/merged. Upgrade `38336325763` is complete and independently verified. Never rerun it. Persistent login/current hosted URL and First Light remain unqualified. Next: implement and qualify persistent synthetic-owner credential provisioning and current-source Preview execution, retaining protected reviews, exact target/source admission, provider restrictions and production hold. No deployment or credential change occurred during this read-only recovery.

## October 13 recovery continuation — qualified owner credential source and executor

PR #439 merged into integration at `b1e6226e59d275f232cc6624ce7fa0eccf856ae5`, tree `9fbbef0709876e439d2d4bac2f9dc4b226a69ad6`. Qualified candidate `b4bd905041da9223ed7314d5000914addfead53d` differs from integrated code only in the recovery checkpoint, verified by GitHub comparison. Exact-source regression `38400798944` passed 106 combined staging cases, 1,874 existing regression tests, TypeScript and every configured Chromium step. The regression archive `11815387139` was independently downloaded; SHA256 `5268f91de5b0a90ee8d9f9bf291fe1b999253c69e4389e7454271c63bfb03ff0` matched metadata, ZIP CRC passed, 57 files. Application UI did not change; earlier visual evidence is reused.

Owner PostgreSQL rehearsal `38400798857` passed. Artifact `11815225990` independently downloaded; SHA256 `664a89060b6e84e07603f3580349acd9e17407f1917b1b702ad5ba63893958ea` matched GitHub; ZIP CRC passed; both upgrade and owner receipts bind the exact candidate. Owner receipt verifies atomic two-owner initialization, second-owner failure rollback, replay rejection, persistence across reconnect, unchanged schema/ledger and unrelated rows, competing-lock rejection and active membership admission. hosted:false and ownerAccessQualified:false. Initial rehearsal `38400493535` failed because the disposable seed inherited sessionVersion 0 rather than the existing staging fixture's 1; the initializer rejected before mutation. The corrected seed is the only follow-up change.

PR #440 merged into the separate protected executor at `6095da96f0f28672ac5703a27b30eea1130b1111`. Qualified candidate `a59ebea7820d2311d9f9ad27e66a5dc920e7e656`, prospective merge and post-merge trees all `38427a527be9f4ba36dc2adf5392e6009f2d9147`. Credential-free contract `38401271658` and full executor regression `38401271762` passed (1,575 tests, TypeScript and configured Chromium). Executor regression emits no archive; no executor UI changed. The historical executor content is preserved by a Git-blob normalization contract; only the additional named owner track and exclusion of that track from legacy rehearsal are introduced.

The new source uses the actual application password implementation and initializes only packet16-a-owner and packet16-b-owner. Exact current schema and all 25 individual migration checksums, original fixture ownership, protected exact source/target/review checks, atomic two-owner commit and credential-free receipts are required. No enrollment, automatic reset, session minting, migration or deployment. Existing credentials block replay. Source and completed regression/rehearsal run IDs are statically pinned by the executor.

### Actual next gate

Read-only browser inspection on October 13 confirmed the existing signed-in GitHub session and protected environment. Owner reviewer is heliosremedia; administrator bypass is unchecked; only codex/v2-neon-staging-bootstrap is allowed. Environment secrets currently list STAGING_DIRECT_URL, STAGING_NEON_API_KEY, STAGING_VERCEL_BYPASS_SECRET and STAGING_VERCEL_TOKEN. Repository secrets list only NEON_API_KEY. At the previous inspection, required new STAGING_OWNER_PASSWORD_A and STAGING_OWNER_PASSWORD_B were absent in both scopes; the October 13 07:30 MDT continuation below supersedes that state. No secret values were read. The user must enter distinct dedicated 24–256 character staging passwords directly into these two environment secrets and retain them for ordinary synthetic-owner sign-in. Do not paste passwords into chat.

Browser credential-entry guidance requires the user to enter and submit new passwords themselves. Do not fabricate stored credentials or dispatch an operation known to have missing inputs. After those secrets exist, dispatch the existing protected workflow once with the exact inputs below, then honor actual environment review. Standing reversible non-production development authorization remains; never approve/bypass the protected review as the owner.

| Input | Exact value |
| --- | --- |
| Workflow | v2-neon-staging-bootstrap.yml |
| Branch | codex/v2-neon-staging-bootstrap |
| executor_sha | 6095da96f0f28672ac5703a27b30eea1130b1111 |
| candidate_sha | b4bd905041da9223ed7314d5000914addfead53d |
| track | persistent-owner-credentials |
| confirmation | calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging |
| owner_confirmation | initialize-two-synthetic-owner-passwords-only |

At that checkpoint, no new credential operation or workflow dispatch had occurred; see the current continuation below. Never redispatch the completed migration `38336325763`. After credential initialization, independently verify the receipt before adapting the September-only temporary hosted executor to current-source persistent Preview qualification. That implementation and its live ordinary sign-in/reload/logout/tenant-isolation checks remain outstanding; no current owner-testing URL or First Light is qualified.

Git clone/read worked; shell git push failed with “could not read Username for 'https://github.com': No such device or address”; connected GitHub API writes and merges succeeded. Local gh CLI is absent. An optional guessed contract filename returned 404; actual v2-staging-executor-contract.yml was located and read. GitHub connector exposes no dispatch/secret-provisioning tools; the signed-in browser supports the workflow UI but new password entry requires user handoff. No Vercel settings, deployment, live owner passwords or production resources were changed in this continuation. Production ON HOLD.

## October 13 07:30 MDT continuation — credential track dispatched; protected review pending

Jake reported password entry complete. Read-only signed-in browser inspection confirmed both STAGING_OWNER_PASSWORD_A and STAGING_OWNER_PASSWORD_B now exist in the existing helios-v2-staging-bootstrap environment. No values were opened or read. Required reviewer, unchecked administrator bypass and exact allowed executor branch remain unchanged.

Live executor HEAD was independently read as `6095da96f0f28672ac5703a27b30eea1130b1111`. Repository-wide workflow inventory showed no equivalent active run. The connector rejected the workflow-specific runs collection URL with HTTP 400 INVALID_ARGUMENT (“not an allowed public GitHub repository or search endpoint”); the repository-wide actions/runs collection worked. Browser dispatch selected the existing executor branch and loaded its actual credential-track inputs; no main/default-branch modification was needed.

Run [38406194120](https://github.com/heliosremedia/heliosremedia/actions/runs/38406194120) was submitted once with the exact candidate/executor/target/owner confirmation recorded above. GitHub jobs independently confirm initialize_owners job `115326326865` is waiting, with no steps executed. upgrade_current `115326330319` and rehearsal `115326330483` are skipped, with no steps. No migration was repeated, and no new live credential operation has executed yet.

The current required owner action is Review deployments → helios-v2-staging-bootstrap → Approve and deploy on this run only. This approval permits only the reviewed synthetic-owner initialization; it does not deploy an application or change Vercel configuration. The agent must not impersonate the owner reviewer, bypass protection, or duplicate dispatch while waiting. After completion, inspect and independently hash/CRC-check the owner receipt before claiming credentials persisted. Continue current-source persistent Preview implementation and hosted ordinary sign-in verification next. No current testing URL or First Light is qualified. Production ON HOLD.

## October 13 approved credential run — input rejection; current Preview implementation active

Run `38406194120` received the owner's existing environment review and executed the qualified credential source. Its initialize_owners job `115326326865` completed with failure at the fixed `credential-input` phase. Exact log: STAGING_OWNER_CREDENTIALS_BLOCKED: credential-input. The source checks ownerPasswords before protected/provider reads or database connection, so this failure performed no database or credential mutation. Migration/rehearsal jobs remained skipped. No receipt artifact was emitted. Do not rerun automatically.

The two secret names exist, but one or more saved values failed the required rule: distinct passwords, each 24–256 characters, no leading/trailing whitespace or control characters. Logs intentionally cannot identify a value or disclose its length. User must correct secret values directly through the credential-entry handoff before another live owner attempt. Retain protected review and never read secret values.

Independent work continued: PR #441, candidate `78fac8d545cd8ae52237dbca209176a8619530d7`, implements a separate current-source persistent Preview runner. It preserves exact source/schema/provider/environment admission, validates stored synthetic credentials before effects, performs one native Preview POST, checks the build receipt, qualifies ordinary login through the actual login form, refresh/logout/re-login and owned/foreign media reads, and retains hostname bindings only after qualification/cleanup. No runner session is minted. Failures suppress builds, remove run-owned temporary Preview configuration and restore bindings without automatic redeploy/repair. 41 local contract/lifecycle/transport/login-sequence tests and scoped lint passed.

Exact-source regression `38409592844` and native-build/PostgreSQL rehearsal `38409592404` are in progress. The isolated retention rehearsal has simulated provider/HTTP effects and must not be called hosted login qualification. No current testing URL or live provider readiness is claimed. Finish required qualification and source integration, then pin the protected current Preview executor. Production ON HOLD.

## October 13 current Preview source integrated; executor inspection fence qualification

#441 merged at `2f890c32d6ba627e3af49c294f15b7fb61773394`; qualified candidate `78fac8d545cd8ae52237dbca209176a8619530d7` differs from integrated execution bytes only in the recovery checkpoint, independently verified by GitHub comparison. Exact-source regression `38409592844` passed 147 combined staging cases, 1,874 existing regression tests, TypeScript and all configured Chromium. Native-build/PostgreSQL rehearsal `38409592404` passed; artifact `11820716915` independently downloaded, SHA256 `b6597228af8e8d41699e53d2f8612263cdd5e77d21fe15144dda304e585204f8` matched GitHub metadata, ZIP CRC passed and all four receipts bind the candidate. Native Next build digest `0041c11a79fc240ff6f3b365772c1aaf7ab0ed3384724bc3967df6f449f1a6b8`; current schema and ledger admission preserved. Provider/HTTP retention effects are simulated in the isolated rehearsal; hosted:false, ownerAccessQualified:false, deployable:false. Regression archive `11821126510`, SHA256 `db07c8f404e0715737d91bade9ede8b8362d7046a7c2f2d3b26f8cd684e0c29c`, independently matched/CRC passed, 57 files; UI unchanged and earlier visual evidence reused. Integration regression `38410895761` is running without a manual rerun.

#442 is the separate protected Preview workflow pin. Initial candidate `698c955b45af9fc1245fdf24515a6e5251d5aba3` passed its contract, then full regression `38411184369` caught the inspection-job test consuming the newly appended current job. Review also required explicit !inputs.inspect_only on the current job. Follow-up `f419d8992f63acba1b80770f22a64023d55fbb92` adds that guard, excludes current track from legacy qualification, bounds the inspection test to one top-level job, and preserves its no-mutation/no-bypass assertions. Contract `38411870626` passed; regression `38411870709` is running. No live Preview attempt has been dispatched.

Approved owner run `38406194120` remains failed at credential-input, before provider/database reads. Masked log entries independently confirm both secret inputs reached the step. Do not change environment wiring or weaken the password rule to hide this rejection. User must directly correct distinct 24–256 character password values without whitespace/control characters. No stored owner passwords were changed by that run, and no live operation has been retried. Complete #442 qualification, then hand off correction before a new bounded owner initialization. Production ON HOLD.

## Current handoff after #441/#442 qualification

#441 source remains integrated at `2f890c32d6ba627e3af49c294f15b7fb61773394`. Its integration regression `38410895761` completed successfully. Source feature qualification, native-build/PostgreSQL receipts and independent archive verification are recorded above; no application UI bytes changed.

#442 is now merged into protected executor at `9e7dcfc4611ed21e19d7fc1b7a42ff1da109c68d`. Final candidate `f419d8992f63acba1b80770f22a64023d55fbb92`, prospective merge and post-merge tree all `c01f48dfee143bdcf7dccd91eb85af2bb500599a`. Contract `38411870626` and exact executor regression `38411870709` passed (1,578 tests, TypeScript, configured Chromium). The inspection job remains read-only; both deployment tracks explicitly reject inspection mode. This is a protected workflow-only change, not a live Preview deployment.

### Immediate required credential correction

Approved run `38406194120` failed at credential-input and changed no database rows or owner passwords. Both A/B secrets reached the step as masked values. One or more values failed the existing distinct 24–256 character/no-whitespace-or-control-character rule. No value or length was retrieved. User must directly edit STAGING_OWNER_PASSWORD_A and STAGING_OWNER_PASSWORD_B in environment helios-v2-staging-bootstrap. Recommended entry: two different password-manager-generated 32-character values, copied without leading/trailing whitespace or line breaks. Browser policy requires user entry/submission. Keep these values for normal synthetic-owner login and never paste them into chat.

After user correction, do not rerun the old migration. A fresh bounded credential-only dispatch may use the existing named track on the current qualified executor HEAD `9e7dcfc4611ed21e19d7fc1b7a42ff1da109c68d`, candidate `b4bd905041da9223ed7314d5000914addfead53d`, track persistent-owner-credentials, the established exact target confirmation and initialize-two-synthetic-owner-passwords-only. Verify no equivalent active run before dispatch and preserve actual environment review. The unchanged initializer will reject any existing credentials rather than rotate or repair them. Inspect the resulting independent receipt before proceeding.

### Prepared current Preview execution — not dispatched

| Input | Exact value |
| --- | --- |
| Workflow | v2-vercel-staging-qualification.yml |
| Branch | codex/v2-neon-staging-bootstrap |
| executor_sha | 9e7dcfc4611ed21e19d7fc1b7a42ff1da109c68d |
| candidate_sha | 2f890c32d6ba627e3af49c294f15b7fb61773394 |
| track | current-owner-preview |
| current_confirmation | retain-current-preview-for-synthetic-owner-testing-only |
| confirmation | calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging |
| inspect_only | false |

The workflow statically pins integration regression 38410895761 and rehearsal 38409592404 / source 78fac8d545cd8ae52237dbca209176a8619530d7. It does not initialize credentials or migrate. Run only after verified owner initialization. Honor the existing protected review, independently verify the final safe receipt and actual owner login/refresh/logout/tenant isolation, and claim a testing URL only after all live gates pass. No live Preview, Vercel configuration or production change occurred in this continuation. No current testing URL or First Light is qualified. Production ON HOLD.

## October 13 08:51 MDT — corrected credential-only dispatch

Jake reported both password values corrected. Fresh read-only GitHub/browser verification confirms integration HEAD 900c1d6d9ec236fccd7e549e4e0768868b979c65 and executor HEAD 9e7dcfc4611ed21e19d7fc1b7a42ff1da109c68d. Saved secret metadata records A updated 2026-10-13T14:43:24Z and B updated 2026-10-13T14:43:39Z. No secret values were read. Executor post-merge contract 38412950068 and regression 38412949542 completed successfully.

Fresh credential-only run [38416979449](https://github.com/heliosremedia/heliosremedia/actions/runs/38416979449) was dispatched exactly once at 2026-10-13T14:51:28Z with the current executor, candidate b4bd905041da9223ed7314d5000914addfead53d, persistent-owner-credentials track and exact target/owner confirmation recorded above. initialize_owners job 115363920224 is waiting for the existing protected environment review, with no executed steps. upgrade_current 115363922850 and rehearsal 115363922855 are skipped. Never duplicate dispatch or repeat completed migration 38336325763. User must review this new run through the actual environment reviewer; the agent must not approve as owner or bypass controls. After successful completion, independently download/hash/CRC-check and inspect the credential receipt before the prepared current Preview dispatch. No stored credentials, live Preview or production change is claimed. Production ON HOLD.

## October 13 08:53 MDT — persistent credentials independently verified; Preview review pending

Owner run 38416979449 completed successfully after the owner's protected review. initialize_owners 115363920224 passed every step; migration and rehearsal jobs stayed skipped. Artifact 11824728077, staging-owner-credentials-38416979449-1, independently downloaded: SHA256 d3afae85817a3194c03adf3c5c5698190049d6381c83662548a3561f991a60e0 matches GitHub metadata and ZIP CRC passes. owner-credentials-live.json binds candidate b4bd905041da9223ed7314d5000914addfead53d, executor 9e7dcfc4611ed21e19d7fc1b7a42ff1da109c68d and exact existing Neon target. Observation 2026-10-13T14:53:56.978Z: both existing synthetic owners now have persistent credentials/sessionVersion 2, no enrollment, previous sessions invalidated, unrelated rows unchanged, schema 9a0c9c3ca2796e8f4c640c652e51fd0c7132bd30b8f59ab5e755327009ba8d3f and all 25 ledger entries unchanged (ledger c180e1f22e689cdff0598a535176443b3ba37eefe25e07e77354226534ff89e8). Receipt hosted:false/ownerAccessQualified:false. Never replay initialization or rotate credentials automatically.

Current-source Preview run [38417689573](https://github.com/heliosremedia/heliosremedia/actions/runs/38417689573) dispatched exactly once using prepared current-owner-preview inputs above, inspect_only false. Required legacy hosted_confirmation form field carries deploy-preview-and-qualify-synthetic-tenants-only; current job uses current_confirmation and legacy job is excluded. No equivalent active Preview run existed at dispatch. GitHub confirms waiting on exact executor 9e7dcfc. Preserve actual environment review and no-admin-bypass. After approval, inspect run result and independently download/hash/CRC-check its safe receipt, including native source/build provenance, ordinary login/refresh/logout/re-login and tenant isolation, unchanged schema/ledger/data admission and restored suppression/configuration cleanup, before claiming a persistent testing URL. Never redispatch automatically after uncertain deployment effects. The preceding post-click browser observation failed with a strict heading selector, but GitHub API verified dispatch, so no second click occurred. Production ON HOLD; completed migration 38336325763 was not repeated.
