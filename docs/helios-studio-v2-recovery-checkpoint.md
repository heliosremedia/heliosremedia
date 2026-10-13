# Studio V2 recovery checkpoint

Updated October 13, 2026 (UTC). **Production ON HOLD.** Live GitHub is authoritative. This is the single current continuity record; historical evidence remains in the progress ledger and [prior checkpoint](https://github.com/heliosremedia/heliosremedia/blob/e0f57719355a03a3e63918928173c6697f01d813/docs/helios-studio-v2-recovery-checkpoint.md). The owner's continuous-development directive supersedes the earlier temporary feature pause.

## Verified integration

Latest staging dependency integration: PR #437 at `f1d58c8061be4706b7a6a716e217a14afafb3e57`, post-merge tree `9e53cf8f522a03e352d974f5a138a961e2b66fa0`. Qualified execution source `963d33ee9858d6a4d5b4f60131b4b6e07db4a79d`, tree `458785c77d0fb03c4651712d17b3a4754f740d79`; final head `831e36b31460278d5a71f5a165d11f4f55f68bed` differs only in this checkpoint, verified by GitHub comparison. Prospective/post-merge trees match. #434/#435 added exact schema admission and the rehearsed upgrade runner; #437 fixes UTF-8 source validation and qualifies current-source hosted builds. None has yet changed live staging.

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

1. Inspection `38329475195` is complete and independently verified. Do not replay it. The ready branch is on the old schema, with no active owner having a stored password.
2. #434/#435 qualified exact schema/ledger admission and the real upgrade runner on disposable PostgreSQL. #435 regression `38332366975` passed 54 new policy/invocation cases, 1,860 existing tests, TypeScript and all Chromium; rehearsal `38332366928` passed preservation, six executed migrations, Prisma equivalence, repeat no-op and failure/drift/concurrent/already-current rejection.
3. #436 is integrated on the protected executor. Upgrade run [38333803845](https://github.com/heliosremedia/heliosremedia/actions/runs/38333803845) was dispatched once, then cancelled while waiting for review after final code review identified a Buffer/text checksum mismatch in its pinned source. GitHub confirms upgrade_current cancelled and legacy rehearsal skipped, both with no job steps. No live migration ran.
4. **Do not approve, rerun or redispatch run 38333803845 or its old source.** #437/#438 are now qualified and merged. Replacement run [38336325763](https://github.com/heliosremedia/heliosremedia/actions/runs/38336325763) was dispatched once on executor 8c1fb12 after checking no equivalent active run. It is waiting for the existing protected environment review; upgrade_current job 115097118025 has not executed; legacy rehearsal is skipped. No live migration has run. Jake's only required action is Review deployments → helios-v2-staging-bootstrap → Approve and deploy. This named track applies only the six reviewed staging migrations; it does not deploy an application or alter Vercel settings. No review bypass is permitted.
5. After completion, independently download/hash/CRC-check the new receipt and verify exact target, 25-row ledger/current schema, original rows/data retained, and repeat no-op before claiming a live upgrade. Do not blindly retry/repair a failure.
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

Current integration code SHA `f1d58c8061be4706b7a6a716e217a14afafb3e57`; this documentation-only commit follows it without changing qualified code. All implementation through #438 is committed/merged. Replacement upgrade `38336325763` is the only pending protected operation. No live migration, Vercel setting, password or deployment changed during this session. Persistent login/current hosted URL and First Light remain unqualified. Next: environment review, independent upgrade artifact verification, then persistent owner access/current-source Preview implementation. No background development is implied while the session waits for that gate. Production ON HOLD.
