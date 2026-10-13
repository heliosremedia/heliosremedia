# Studio V2 recovery checkpoint

Updated October 12, 2026 (UTC). **Production ON HOLD.** Live GitHub is authoritative. This is the single current continuity record; historical evidence remains in the progress ledger and [prior checkpoint](https://github.com/heliosremedia/heliosremedia/blob/e0f57719355a03a3e63918928173c6697f01d813/docs/helios-studio-v2-recovery-checkpoint.md). The owner's continuous-development directive supersedes the earlier temporary feature pause.

## Verified integration

PR #432 merged into `codex/v2-hosted-access-owner-action` at `3ecb648b30645fd9f9c16d8fe16537ed26c6dba7`. Qualified candidate `b9e46c56ae047cab3f1a48b1d9a5884237c7f079`; candidate, prospective merge and post-merge tree all `1c2220359f2b2db0151542b3ae583437698fff57`. #430 integrated at `5bf220625c3d7cd6520146d325c64beaee39e933`; #431 at `20a2d61d41c14ca59cc2331c3ffce332cf248352`.

The documentation commit carrying this checkpoint follows that merge without changing application/test/runtime source. Check live HEAD for it or newer work before acting. No unfinished implementation is left on these three PRs. Post-merge regression `38191421425` passed on `3ecb648b30645fd9f9c16d8fe16537ed26c6dba7`; verified again October 13 UTC without rerunning it.

Protected inspector: `codex/v2-neon-staging-bootstrap` remains `b78600b3080dfa97dc263b13c2fca6bae30bf158` (#428). Its existing regression/contract runs `38177277278`, `38177277212`, `38177277232` passed. This older executor is separate from the application branch; do not merge its application baseline.

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

## Owner-accessible staging: concrete blocker

Read-only inspection `38159974154` completed on old executor `d65a1c98675c123d5b710dbf70cdcd3554f5b869`. Provider identity checks passed, then `CHECK_NEON_BRANCH_STATE` stopped before database access because state was not `ready`. The old receipt omits the exact state. No suspension, deletion or schema diagnosis is established.

The #428 executor now records sanitized branch state while preserving the ready guard. Manual workflow history was rechecked this continuation: no newer/equivalent inspection is queued or running. This session lacks an authenticated workflow-dispatch capability; repository writes and Actions reads work, but no dispatch action is exposed, gh is absent, and the previously checked browser is signed out. Direct Neon read-only metadata returns internal authorization HTTP404 / UNAVAILABLE; that is not evidence of a missing branch. No settings, credentials, migrations or deployments were changed.

Existing targets:
- Vercel `helios-v2-staging`, project `prj_PUv0ADGxYl5QjRYaMv2h8Km1UmMg`, account `team_H79eaUfq9xMqcbf34ZCtwwn9`. Default-scope discovery found it; explicit scope selectors had empty/404 responses. Do not recreate it.
- Neon organization `org-nameless-shape-94202911`, project `calm-shape-83359560` / `helios-v2-staging`, branch `br-young-math-arj7l4r3` / `main`, database `helios_v2_staging`. Jake's earlier other-email/org screenshot was a different project; it did not prove deletion.
- Preview build suppression and environment protections are intentional. Historical September hosted source is not the current Studio application.

## Next safe gates

1. Through a supported authenticated dispatch path, recheck executor SHA and active runs, then run existing [protected inspection](https://github.com/heliosremedia/heliosremedia/actions/workflows/v2-vercel-staging-qualification.yml) with the inputs below. Preserve the `helios-v2-staging-bootstrap` environment review and no-admin-bypass policy. Ask Jake only if an actual environment review requires his approval, with the exact run link.
2. Independently download/hash the inspection artifact. Verify target/scope, exact branch state, catalog/ledger and password readiness. If state is not ready, retain the guard; diagnose before proposing any change.
3. Use the observed database state to prepare current-source admission and the existing six-migration upgrade (#415 already rehearsed on disposable PostgreSQL). Live staging ledger/schema remain unknown. Persistent non-production owner credentials and explicit V2 workspace allowlisting remain incomplete.
4. Obtain any separate approval required for concrete consequential credential/provider/infrastructure changes or unexpected database risks before execution. Do not restart/restore/recreate infrastructure speculatively. Then qualify the continuous hosted owner workflow and protected Studio URL before claiming access/First Light.
5. Continue bounded independent product work under standing authorization while dispatch is unavailable; use actual roadmap gaps, not a new hardening program.

| Inspection input | Exact value |
| --- | --- |
| Branch/ref | `codex/v2-neon-staging-bootstrap` |
| executor_sha | `b78600b3080dfa97dc263b13c2fca6bae30bf158` |
| inspect_only | `true` |
| confirmation | `calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging` |
| candidate_sha | `inspection-only` |
| hosted_confirmation | `read-only-inspection` |

The sentinels cannot admit deployment. Inspection uses provider GETs and a read-only database transaction/rollback only if the ready guard passes. No provider activation, real customer onboarding, billing, destructive operation or production change is authorized. Production remains ON HOLD.


## October 13 UTC continuation: owner sign-in recovery

Live recovery found integration HEAD `194a32049bf574aa2b539184bef1fab67044744d` and executor `b78600b3080dfa97dc263b13c2fca6bae30bf158` unchanged; no active workflow or newer product PR. Existing protected inspection history still ends at `38159974154`. Current connector inventory has no dispatch action and gh is absent. A fresh browser check found GitHub signed out. Secure browser authentication reached Google's password stage, but automatic approval review rejected password entry because the page reported a wrong password; the user must choose retry or another sign-in method. No password or credential was read, no alternate path bypassed the rejection, and no inspection was dispatched. Smallest access restoration: complete GitHub authentication through the supported secure browser flow (user chooses the next method); then recheck duplicate runs, dispatch exact inspection-only inputs, and preserve environment review. This is an authentication requirement, not missing owner development authorization.

Active bounded work on `codex/v2-owner-login-recovery`: the login form currently exposes raw transport/JSON errors and unlocks immediately after requesting navigation. Add clear connection recovery, prevent duplicate pending submissions, preserve entered fields on failure and keep submission locked during confirmed navigation. Authentication API, password policy, cookies, session/tenant controls, schema, provider settings and deployment remain unchanged. Add styled 390/1440 actual-component Chromium coverage with synthetic credentials/transport. Existing #432 actual-server ordinary-password evidence remains valid for unchanged backend contracts. Required regression/TypeScript/Chromium, independent responsive artifact inspection and merge-tree verification pending. Local Next package documentation is unavailable in this scratch workspace; the official App Router useRouter guide was reviewed and existing replace/refresh calls retained. Production ON HOLD.
