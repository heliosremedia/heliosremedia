# Studio V2 live recovery checkpoint

Updated October 11, 2026. **Production ON HOLD.** Recover from live GitHub before any mutation. This is the canonical continuity record; the roadmap and progress ledger provide product priorities and historical evidence.

## Verified integrated state

| Scope | Branch | Verified integration | Qualified candidate / tree |
| --- | --- | --- | --- |
| Studio application through #427 | `codex/v2-hosted-access-owner-action` | `f45e4cb4ed7bd8f874760dfe6c9ea02bc692f21b` | Qualified candidate `02ac4ba83226e0f121bd75e58131a567f25ee805`; integrated tree `0b097b49ed21a30606d4ba03fa3d8b30245d54c6` |
| Protected read-only staging inspector #420 | `codex/v2-neon-staging-bootstrap` | `d65a1c98675c123d5b710dbf70cdcd3554f5b869` | Candidate `aa792c212d18a24593ba93d5128331b056fc33d2`; tree `8139278ebc86b630c30f5bc150a0f37c402e598e` |

Prospective and post-merge trees were independently compared with each qualified candidate. The documentation-only update carrying this checkpoint leaves application/runtime source unchanged; always inspect the live branch for that documentation commit or newer work. Main and production were not changed. #420 modifies only the existing protected workflow, a read-only diagnostic script and its tests; it does not merge the older executor application into the Studio integration branch.

## Functionality now integrated

- Workspace-aware shell, Command Center, project creation/information, registered synthetic media management, reviewed services, setup navigation and private review/revocation.
- Ordinary password sign-in through the complete private project workflow on two synthetic companies, including logout and exact credential/audit restoration.
- Reviewed publish, unpublish and archive with current administrator authorization, project revision/status checks and explicit uncertainty recovery. Publishing rechecks owned active services and visible/playable media under locks.
- Featured placement preserves the six-project cap across both writers. Expired renewals consume capacity. The featured-list editor binds candidates, placement windows and saved order to a workspace-specific revision, preserves local selections after uncertain saves, and requires explicit review before retry. Keyboard sorting and replacement are qualified.
- Archived projects can return to a private draft without meeting publication requirements. The Projects list keeps status and edit controls visible on phones and preserves return filters.
- Project ordering binds the complete owned list to a reviewed revision and fresh editor authorization under locks. Exact receipts, duplicate-save guards and retained attempted order/selection support explicit recovery after uncertain saves.
- Inquiry details use an accessible keyboard dialog. Status, assignee and follow-up updates wait for server confirmation; transport failure retains the last confirmed state and offers a clear retry message.
- Inquiry-to-project handoff creates a private draft from workspace-scoped property location, preserves customer messages/contact in the inquiry, and records an activity link to the project. Replays are idempotent.
- Existing Preview read-only restrictions remain. Isolated qualification does **not** establish hosted publishing, owner access, live providers or First Light.

## Current qualification evidence

| Change | Regression | Isolated runtime | Independent verification |
| --- | --- | --- | --- |
| #418 publishing / placement | `38063753494`: 1,856 tests, TypeScript, all Chromium | `38063753495`: six cases, 22 observed authority/dependency races across two companies; schema/access/fixture cleanup passed | Runtime artifact `11674205546`; screenshot artifact `11674760645`; four 390/1440 success/recovery images inspected |
| #419 featured-list review / recovery | `38065081061`: 1,859 tests, TypeScript, all Chromium including keyboard ordering | `38065081090`: two list cases/eight observed authority/revision races, plus all prior publishing cases; schema/access/fixture cleanup passed | Runtime artifact `11675106730`; screenshot artifact `11674312436`; four 390/1440 success/recovery images inspected |
| #420 protected inspection | `38065154309`: 1,571 tests on the existing executor baseline, TypeScript, all configured Chromium | No hosted inspection has run. 159 local credential-free executor/admission/inspection checks and lint passed | Source limited to three reviewed files; no application/schema/dependency change; exact integration tree verified |

All listed runtime/screenshot ZIPs were separately downloaded and SHA256 matched to GitHub metadata. JSON candidate identity and relevant authorization, concurrency, ownership and cleanup outcomes were inspected. Screenshot evidence was visually inspected, not inferred from workflow badges.

| Artifact | ZIP SHA256 |
| --- | --- |
| `11674205546` | `74aba91ad3780fcaa1ebd68562e0c57dec895593cf696db7f20a584f40008ddd` |
| `11674760645` | `d39a9d609d78627c67b4cf8dbf7c913820cd12b0d3c9e38472d8ee312022fd3c` |
| `11675106730` | `61d253908355ee09776c5d3346282ab9dae4305c67ba2643c87aa4042cb66289` |
| `11674312436` | `7600ea917ae2170215270896f1a4d6940fa1e230efa7bd4599bcf672ba170ce6` |

#418 integration: `e4aa3031dc74eef476c935807c1ab8821aaa7099`, tree `3cef159d8ffa75e78b2e0e7d323d4e2603a795fb`, candidate `2f1b7330dbfee4921ea5530c473848f436d89ddb`.

Earlier evidence remains valid: #415 current-schema upgrade rehearsal integrated at `b231046863a341c198e80d65aac139ec82ca95c5`; runs `38060380830`/`38060380786`; artifact `11672438840` SHA256 `ce7cd03e3bacb03f75c246875f321f035feb621faa262733550f2f9d29aa927c`. It proves six existing migrations, retained ledger/private data, current Prisma equivalence and repeated-deploy no-op in disposable PostgreSQL. #416 sign-in/private workflow integrated at `bec844bea9898227fe49cd605ecce1060978ca84`; runs `38060682561`/`38060682637`; artifact `11672254799` SHA256 `e68550273b538fe2f0b033551576b344ca8db799c9f2d6d0f0b02dda5e662223`. Historical detail is retained in the existing progress ledger and Git history.

## October 10 continuation: qualified project lifecycle and browsing

| Change | Integrated commit / candidate tree | Qualification |
| --- | --- | --- |
| #422 restore archived project to draft | Integration `14fe732dd936fa8c570256ac4f3fcbf95212b0be`; candidate `f3ac5c278be9ee9be786d1f875042acc9e68350f`; tree `78623720b604921bb5caa24011d4439f1f48cfa4` | Regression `38076985735`: 1,859 tests, TypeScript, all Chromium. Runtime `38076985691`: six two-company status cases and 24 observed authority/ownership races, including restoration, stale/concurrent requests and retained content. Four responsive success/recovery images inspected |
| #423 responsive project list | Integration `a03ee33d198c2bbb3fdffe649ae59b456b818e2d`; candidate `c957976a13e1cc244ca7fc0db3a748be2ebb65c4`; tree `342708485a98e8461202c5fb2eec9188683061bf` | Corrected regression `38077562965`: 1,859 tests, TypeScript, all Chromium, including selection moves, keyboard ordering, phone visibility and retained filters. Two responsive images inspected. #422 runtime evidence reused for unchanged backend/runtime code |
| #424 reviewed project ordering | Integration `bb5c9c5ac2e69f89091d02eaff92b00f8a5e9f06`; candidate `6299c358352de91675cecf14a50412ca8bd2eaba`; tree `9af174c9f9ab9fc3e6be3d7889e5ec25a20e75d6` | Regression `38078067769`: 1,859 tests, TypeScript, all Chromium including pending and six held ordering outcomes. Runtime `38078068060`: two company cases and ten observed viewer/revocation/suspension/ownership/content races, stale/concurrent rejection, ordered receipts, editor allowance and retained fields. Four responsive normal/recovery images inspected |

All prospective and post-merge trees match their qualified candidates. Runtime JSON binds exact candidates; fixture restoration, schema/access postflight and relevant authority/ownership outcomes were inspected. Each ZIP below was independently downloaded and SHA256 matched to GitHub metadata.

| Artifact | ZIP SHA256 |
| --- | --- |
| #422 runtime `11679027328` | `e650c87cef197c7175e65266eca980ed1ee5b5f4a6556e6b93f574b888d194ad` |
| #422 screenshots `11679452667` | `553e01302b3ce9fae256967bf8ef8ee56ef610d3a17e79f3aa47e0bf3cd8c39f` |
| #423 screenshots `11679603241` | `158e860ce4bc64daaf6267ffd4e3949c2dae1ab8a1d1c19745f9398060adf025` |
| #424 runtime `11678877850` | `689244327ed2299606e50f4cd23d004f88363c16ad7116657006bd23bdbb5989` |
| #424 screenshots `11679004737` | `b05dbcfb74a552289f645d323a3bb393b244c6805d12435e5a951f5548b1dfc8` |

The ordering change followed a reproduced stale overwrite in the actual route with synthetic in-memory delegates: a newer order and an older replacement both returned 200. The final isolated PostgreSQL/Next qualification independently proves stale rejection and single-winner concurrency. Existing OWNER/ADMIN/EDITOR content-write eligibility is preserved; VIEWER is denied by the shared editor-write boundary. No schema/provider/deployment changes occurred. Broader bulk-media contracts remain separate.

## October 11 continuation: qualified inquiry workflow

| Change | Integration | Qualification |
| --- | --- | --- |
| #426 inquiry accessibility and confirmed-state recovery | `db3cbb0161af58d36b4e6345410060153450c161` (qualified candidate `63fdcacf5fc8a4a0751bdff84f7cc79df07c11d9`) | Regression run `38122085985`: isolated regression suite, TypeScript and all configured Chromium checks passed, including inquiry dialog keyboard focus, Escape/return focus, phone/desktop overflow, acknowledged workflow state and failed-save recovery. Screenshot artifact `11695947503` was uploaded (GitHub SHA256 `b4cc7b45d06b0411d2bdd22218b952fe9e55958c0474db3482ace72314211785`). |
| #427 tenant-scoped inquiry-to-project draft | `f45e4cb4ed7bd8f874760dfe6c9ea02bc692f21b` (qualified candidate `02ac4ba83226e0f121bd75e58131a567f25ee805`) | Regression run `38123653380`: isolated regression suite, TypeScript and all configured Chromium checks passed, including 390/1440 inquiry handoff links and project form prefill. Focused project-draft tests cover workspace ownership, replay and activity linking. Screenshot artifact `11696860148` was uploaded (GitHub SHA256 `91459ac52a9da3451498459d7ef2a60b59b83dbce6feb386b19710e91de6b96b`). |

No schema, database, provider, credential, deployment or production changes. This isolated UI qualification makes no claim about hosted owner access or First Light.

## October 11 PM-directed staging resumption

New feature development is paused. Owner-accessible non-production staging is the immediate milestone.

Independently downloaded existing artifacts without rerunning tests:
- #426 run `38122085985`, candidate `63fdcacf5fc8a4a0751bdff84f7cc79df07c11d9`, artifact `11695947503`: ZIP SHA256 `b4cc7b45d06b0411d2bdd22218b952fe9e55958c0474db3482ace72314211785` matches GitHub metadata; ZIP CRC check passed.
- #427 run `38123653380`, candidate `02ac4ba83226e0f121bd75e58131a567f25ee805`, artifact `11696860148`: ZIP SHA256 `91459ac52a9da3451498459d7ef2a60b59b83dbce6feb386b19710e91de6b96b` matches GitHub metadata; ZIP CRC check passed.
- Visually inspected both candidates' `studio-inquiries-390.png` and `studio-inquiries-1440.png`, plus #427's `studio-project-create-390.png` and `studio-project-create-1440.png`. Inquiry images show the fixture content, confirmed-state failure message and (for #427) draft/activity links. Project-create images show the styled source-inquiry notice, retained fields, validation message and private-draft controls at both widths.
- Limitation: the inquiry screenshots are unstyled component fixtures. Source inspection of `scripts/browser/run-inquiry-workflow.mjs` confirms an esbuild component harness with mocked fetch/router and no application stylesheet. Its overflow assertions therefore do not establish production-styled responsive layout or actual hosted navigation/persistence. These screenshots cannot qualify the real inquiry modal's visual presentation. The ZIPs contain screenshots, not PostgreSQL authorization/cleanup receipts. Existing passing CI remains valid for its stated synthetic scope; no new hosted/runtime qualification is claimed.
- Remaining verification: inspect the real styled inquiry page and continuous inquiry-to-draft workflow during protected hosted qualification, including authorization, persistence and cleanup. Do not equate the recovered screenshots with full hosted qualification.

Live reconciliation before this documentation update: application head `8d713f284b0e44869d69ef8728aebc2bd636e7e8`; exact-head integration regression `38124285356` passed. Executor remains `d65a1c98675c123d5b710dbf70cdcd3554f5b869`. Manual workflow history still ends at historical run `36217912507`; no equivalent new inspection is queued or running. Jake's next action remains the exact read-only dispatch and existing environment approval below. Recheck history before dispatch to avoid duplicates.

After the inspection, independently download/hash its artifact and inspect target identity, provider scope results, ledger/catalog and password-readiness evidence before proposing changes. Current-source admission, the rehearsed staging migration path, persistent owner credentials and explicit workspace allowlisting remain incomplete. Present exact changes and any consequential credential/infrastructure or unexpected database risks for separate owner approval before execution. Do not recreate infrastructure, change protection/suppression policy or deploy production. Normal reversible non-production work remains within standing authorization, subject to existing protected environment review.

## Active milestone: current hosted owner access

**No current Studio owner-testing URL is qualified.** Read-only inspection run `38159974154` completed after Jake's approval. Vercel identity/scope checks passed; database inspection stopped at `CHECK_NEON_BRANCH_STATE` before connection. Next: establish the actual Neon branch state via read-only metadata, then reconcile schema/ledger and owner sign-in requirements.

Verified discovery to date:

- Default-scope Vercel discovery finds existing `helios-v2-staging`, project `prj_PUv0ADGxYl5QjRYaMv2h8Km1UmMg`, expected account `team_H79eaUfq9xMqcbf34ZCtwwn9`. Explicit scope selectors returned empty/404. The protected inspector compares both scopes using the existing runner credential; do not assume this is a missing project or recreate it.
- Git integration is connected; suppressed Preview builds are intentional. Historical protected hosted run `36217912507` succeeded for September source `2999055b2b59467fcfef446c33a47212e72d4712`, not current Studio. Its independently recovered artifact `10907013060` has SHA256 `a97ea9cc5b4b1453fe22cd9b0085803085f97e5405d0a1d46dcbd5bbf5c30437`.
- Neon connector discovery returned an internal authorization error. Current live ledger/schema are unknown. The existing hosted source admission still pins the older baseline; the qualified six-migration upgrade has not been applied to staging.
- Historical hosted fixtures used password-null synthetic owners and temporary runner-signed cookies. Persistent owner sign-in and explicit V2 workspace allowlisting still need qualification.

### Historical dispatch instructions (run completed; do not replay unchanged)

The existing `helios-v2-staging-bootstrap` GitHub environment requires owner review, forbids administrator bypass and admits only the existing executor branch. These requirements come from `scripts/staging/policy.mjs` and remain unchanged. This session's GitHub connector has no workflow-dispatch capability. **Inspection `38159974154` has now completed. Do not dispatch again merely to repeat this result.**

Run [V2 manual protected staging Preview qualification](https://github.com/heliosremedia/heliosremedia/actions/workflows/v2-vercel-staging-qualification.yml) with these inputs, then approve its existing environment review:

| Input | Exact value |
| --- | --- |
| Branch / ref | `codex/v2-neon-staging-bootstrap` |
| `executor_sha` | `d65a1c98675c123d5b710dbf70cdcd3554f5b869` |
| `inspect_only` | `true` |
| `confirmation` | `calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging` |
| `candidate_sha` | `inspection-only` |
| `hosted_confirmation` | `read-only-inspection` |

The last two values are deliberate non-deploying sentinels. They are unused by inspection and cannot admit the deployment job if the inspection checkbox is omitted. If the branch has advanced, verify the new executor before changing the SHA; never blindly replay a run.

Equivalent owner CLI invocation:

```sh
gh workflow run v2-vercel-staging-qualification.yml \
  --repo heliosremedia/heliosremedia \
  --ref codex/v2-neon-staging-bootstrap \
  -f executor_sha=d65a1c98675c123d5b710dbf70cdcd3554f5b869 \
  -F inspect_only=true \
  -f confirmation=calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging \
  -f candidate_sha=inspection-only \
  -f hosted_confirmation=read-only-inspection
```

Inspection verifies the environment gate and exact target, issues fixed GET-only provider metadata requests, and uses a repeatable READ ONLY database transaction followed by rollback. It exports only safe metadata, catalog/ledger hashes and aggregate counts. It makes no deployment, schema, data, hostname, suppression, credential or provider-activation change. The receipt always reports `deployable:false` and `ownerAccessQualified:false`.

## October 11 owner Neon dashboard screenshot

Jake's dashboard screenshots show the selected Neon organization `Helios RE Media`, URL organization ID `org-dawn-sunset-51163361`, and only project `helios-studio` (project slug `blue-tooth-89291805`) with one `production` branch. This is distinct from the protected inspector's expected staging organization `org-nameless-shape-94202911`, project `calm-shape-83359560` / `helios-v2-staging`. The screenshot establishes an organization/account scope mismatch; it does not establish staging deletion. Do not create a project/branch or change production. Next read-only step: inspect the Neon organization selector for `org-nameless-shape-94202911`. If unavailable, the Neon organization owner must grant Jake's account access or confirm the staging project was moved. Production remains ON HOLD.

## October 11 protected inspection result

Jake dispatched and approved run [38159974154](https://github.com/heliosremedia/heliosremedia/actions/runs/38159974154). Exact executor `d65a1c98675c123d5b710dbf70cdcd3554f5b869`; inspect completed successfully; deployment/qualify job skipped. Success means diagnostic collection completed, not staging readiness.

Artifact `11709634858` (`staging-readonly-d65a1c98675c123d5b710dbf70cdcd3554f5b869`) was independently downloaded. ZIP SHA256 `b5e0638f47cf4f6ddc61b077d01ef9e95373e5d82a89bb1644866d09294937fe` matches GitHub metadata; CRC check passed; sole file `readonly-inspection.json` parsed and inspected. Observation time `2026-10-11T17:32:05.293Z`, exact executor/target matched, mode read-only, deployable=false, ownerAccessQualified=false.

- Vercel default and expected-team scopes both returned HTTP 200, expected project/team=true, gitConnected=true, automaticBuildsSuppressed=true. This resolves the runner's scope/access question; prior connector-only empty/404 results do not establish a missing project.
- Neon metadata passed the earlier project ID/name/organization/region/PostgreSQL 16 and branch ID/project/name checks, then failed `CHECK_NEON_BRANCH_STATE`. Reviewed `targetConnection` requires `branch.current_state === 'ready'`. Receipt intentionally omits the actual state; neither suspension nor a missing/deleted branch is established.
- Code inspection confirms this failure occurs before constructing/connecting the PostgreSQL client. No database transaction, schema/ledger/password counts or database cleanup evidence was produced. No database/deployment/configuration mutation occurred in this read-only path.
- Direct read-only Neon connector get_branch follow-up returned internal authorization HTTP 404 / UNAVAILABLE. It did not resolve the actual branch state. Runner Neon metadata access itself succeeded, so do not conflate the connector error with missing runner credentials.

Next concrete step: obtain the exact branch's current_state from read-only Neon dashboard/API metadata (owner can provide a screenshot of project helios-v2-staging, branch main, ID br-young-math-arj7l4r3) without changing settings, restarting compute, restoring or recreating infrastructure. Alternatively qualify a bounded diagnostic-only executor update that records the state while retaining the existing ready-state guard. Do not relax the guard speculatively.

After the branch-state cause is understood: collect the protected database snapshot; compare live schema/ledger with the qualified baseline and six-migration rehearsal; prepare current-source admission and any needed protected migration; establish a persistent non-production owner credential and explicit V2 workspace allowlist; qualify ordinary login/logout, isolation, styled responsive inquiry/private-project navigation, persistence and cleanup on the exact hosted candidate before issuing a tested URL.

No infrastructure/database modification is proposed for execution yet. Any restart/reactivation/restore, changed credential scope, protection policy, unexpected ledger repair, destructive operation or material new infrastructure decision must be described concretely and receive any required separate owner approval first. Normal reversible non-production work remains preauthorized; all existing environment reviews remain mandatory. New features stay paused; production ON HOLD.

## Next authorized work and boundaries

1. Inspect the live workflow state before any replay. Independently download/hash the inspection artifact and review scope results, database identity, catalog/ledger and password-readiness counts. A green diagnostic job means evidence was collected, not that hosted readiness passed.
2. Use that evidence to prepare current-source staging admission and the already-rehearsed six-migration path through the existing protected process. Stop for unknown ledger/data states or consequential credential/provider decisions; do not auto-repair or recreate infrastructure.
3. Establish persistent non-production owner login and explicit V2 workspace allowlisting, then qualify the continuous private-project flow against the hosted environment before giving the owner a testing URL. Preserve Preview limits and existing module guards.
4. New feature development is paused by the October 11 PM directive. Resume independent product work only after direction changes. Bulk media organization and unqualified outbound/module families retain their separate contracts. No general Phase 1 hardening expansion is needed.

Normal reversible non-production work remains preauthorized. Production, destructive operations, consequential security/architecture changes, billing, real providers and external customer onboarding remain owner-gated. First Light is not achieved.

## Recovery efficiency

No successful historical suite was rerun merely because this session recovered. This continuation reused #422 runtime evidence for #423 and performed two new runtime qualifications for changed lifecycle/ordering behavior. #423 required one corrective regression after the initial CSS dropped the existing sticky-actions requirement; the implementation was corrected and the test retained. All three implementation PRs are integrated with no outstanding qualification gate. The documentation-only continuity update reuses their unchanged application evidence. New implementation triggered normal exact-head CI. Additional runs resolved two test defects: #419's keyboard driver raced deferred sensor setup; #420's assertions initially failed TypeScript. Final passing runs supersede those failures. A local Chromium download returned a truncated archive; local browser qualification is not claimed. GitHub checkpoints and artifacts remain authoritative, with no second project-state system.

## October 11 continued recovery and product progress

This entry supersedes earlier active-work descriptions above where they conflict. Production remains **ON HOLD**.

Live GitHub reconciliation:
- Integration branch `codex/v2-hosted-access-owner-action`: `9e5429518b672cca77609c7e5520fc16093e4a98`. The integrated Studio product history through #427 remains documented above; this current integration head contains subsequent documentation-only commits.
- Protected executor branch `codex/v2-neon-staging-bootstrap`: `b78600b3080dfa97dc263b13c2fca6bae30bf158`, the merged #428 diagnostic update.
- #428 regression `38177277278`, executor contract `38177277212`, and isolated tenant route contract `38177277232` completed successfully on the exact executor SHA. No suite was rerun during this recovery.
- Protected inspection history was rechecked. Latest run `38159974154` completed successfully on old executor `d65a1c98675c123d5b710dbf70cdcd3554f5b869`; no equivalent run is queued or active. It did not reveal Neon `current_state`. No artifact exists for the new executor, so the exact Neon branch state and live database snapshot remain unknown.
- The new dispatch is blocked in this Work session: the GitHub connector exposes read-only workflow-run retrieval but no `workflow_dispatch` action, the available `gh` executable is absent, and the GitHub Actions page in its cloud browser is signed out. No credential was guessed, no protection was bypassed, and no dispatch was submitted. This is a session tooling/authentication limitation, not evidence of a Neon/Vercel issue. Continue immediately through any later authorized dispatch-capable GitHub session; preserve the existing environment review, inspect-only inputs, database read-only transaction, and `ready` guard.
- Open PR inventory still contains the older stacked draft chain beginning with #322 and proceeding through #223. The live integration branch is a separate maintained line; do not merge or replay those historical drafts without checking their intended base.

Independent product work started while the protected dispatch path is unavailable:
- Branch `codex/v2-command-center-local-time`, based on the verified integration head, changes Command Center schedule and snapshot display from fixed UTC labels to the viewer's local browser timezone. Server-rendered output remains explicit UTC until hydration; event instants and persisted records do not change.
- The existing Chromium qualification is extended to emulate `America/Denver` and assert the scheduled event renders as `Oct 10, 10:30 AM MDT` at 390px and 1440px. TypeScript, regression, and Chromium CI are pending. This is not yet qualified or integrated.

Active work: qualify the local-time Command Center change, correct any demonstrated failures, and merge only if standard required checks pass. Then continue the highest-value independent product capability while preserving the protected staging gate.

Next staging gate: obtain an authorized GitHub Actions dispatch path for the exact executor SHA above. Start the existing inspection-only workflow with the documented sentinels and inputs, then stop at its existing `helios-v2-staging-bootstrap` environment review if presented. After approval, independently download/hash/inspect its artifact and report branch state. If the branch is not `ready`, leave database access blocked. Do not change Neon/Vercel settings, run migrations, deploy, recreate infrastructure, or touch production.

