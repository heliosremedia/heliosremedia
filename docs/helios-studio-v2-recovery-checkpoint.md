# Studio V2 live recovery checkpoint

Updated October 10, 2026. **Production ON HOLD.** Recover from live GitHub before any mutation. This is the canonical continuity record; the roadmap and progress ledger provide product priorities and historical evidence.

## Verified integrated state

| Scope | Branch | Verified integration | Qualified candidate / tree |
| --- | --- | --- | --- |
| Studio application through #419 | `codex/v2-hosted-access-owner-action` | `8bf2729fab0e6309ec1e8d7275e741334daa7c1d` | Candidate `99b620b51903abf1221140d756a8476d8101188a`; tree `890846bedc04d010a76af2d88913d6b566876942` |
| Protected read-only staging inspector #420 | `codex/v2-neon-staging-bootstrap` | `d65a1c98675c123d5b710dbf70cdcd3554f5b869` | Candidate `aa792c212d18a24593ba93d5128331b056fc33d2`; tree `8139278ebc86b630c30f5bc150a0f37c402e598e` |

Prospective and post-merge trees were independently compared with each qualified candidate. The documentation-only update carrying this checkpoint leaves application/runtime source unchanged; always inspect the live branch for that documentation commit or newer work. Main and production were not changed. #420 modifies only the existing protected workflow, a read-only diagnostic script and its tests; it does not merge the older executor application into the Studio integration branch.

## Functionality now integrated

- Workspace-aware shell, Command Center, project creation/information, registered synthetic media management, reviewed services, setup navigation and private review/revocation.
- Ordinary password sign-in through the complete private project workflow on two synthetic companies, including logout and exact credential/audit restoration.
- Reviewed publish, unpublish and archive with current administrator authorization, project revision/status checks and explicit uncertainty recovery. Publishing rechecks owned active services and visible/playable media under locks.
- Featured placement preserves the six-project cap across both writers. Expired renewals consume capacity. The featured-list editor binds candidates, placement windows and saved order to a workspace-specific revision, preserves local selections after uncertain saves, and requires explicit review before retry. Keyboard sorting and replacement are qualified.
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

## October 10 continuation: private restoration and mobile Projects

PR #422 is integrated at `14fe732dd936fa8c570256ac4f3fcbf95212b0be`, exact tree `78623720b604921bb5caa24011d4439f1f48cfa4`, candidate `f3ac5c278be9ee9be786d1f875042acc9e68350f`. Archived projects now have **Restore to draft**, reusing the reviewed status operation. Incomplete projects can resume private preparation; publishing remains separate. Existing authorization, revision/status checks and uncertainty holds remain.

Regression `38076985735` passed 1,859 tests, TypeScript and all Chromium. Runtime `38076985691` passed six two-company status cases and 24 observed authority/ownership races, including restoration, concurrent single-winner/stale rejection and retained content. Exact candidate, schema/access restoration and cleanup were inspected. Runtime ZIP `11679027328` SHA256 `e650c87cef197c7175e65266eca980ed1ee5b5f4a6556e6b93f574b888d194ad`; screenshot ZIP `11679452667` SHA256 `553e01302b3ce9fae256967bf8ef8ee56ef610d3a17e79f3aa47e0bf3cd8c39f`. Both independently downloaded/hash-matched; four 390/1440 restoration success/recovery images visually inspected. Prospective and integrated trees match.

PR #423 candidate `c957976a13e1cc244ca7fc0db3a748be2ebb65c4`, tree `342708485a98e8461202c5fb2eec9188683061bf`, adds a compact phone layout with visible project status/location/media/date and edit controls, title links with retained filters and unchanged ordering handlers. Initial regression found the existing sticky-actions requirement; the corrected implementation preserves sticky actions at every breakpoint without weakening the test. Corrected regression `38077562965` passed tests/TypeScript; browser and independent screenshot/final integration gates remain pending. No backend/schema/provider changes; reuse #422's unchanged runtime evidence. No new bulk-writer certification is claimed.

Next bounded product dependency identified from source: reviewed project ordering. `app/api/admin/projects/order/route.ts` reads the owned ID set before its update transaction and accepts no reviewed revision; the client can submit overlapping saves and rolls back visually on uncertain transport. Qualify stale/concurrent order changes and current authorization/ownership at the write boundary using existing workspace/project locks and explicit saved-order recovery, without rewriting bulk media or unrelated modules. This is a source-backed open dependency, not a completed runtime reproduction or new readiness claim.

## Active implementation: reviewed project ordering

A synthetic-delegate probe of the actual ordering route reproduced a stale overwrite: a first save accepted `[p2,p1]` with HTTP 200, then an older list accepted `[p1,p2]` with HTTP 200. This is an actual-route baseline with in-memory delegates, not PostgreSQL race proof.

The current candidate binds the complete owned order to a workspace-specific revision, rechecks editor access and the owned project set under existing workspace/account/membership/project locks, requires every scoped update to affect one row, and returns exact ordered IDs plus a fresh revision. OWNER/ADMIN/EDITOR retain editor-write eligibility; VIEWER is read-only under the existing shared editor-write guard. The UI pauses duplicate/overlapping actions and retains the attempted order and selection after an uncertain/malformed/stale receipt, requiring explicit saved-list review. No schema/provider/deployment changes.

Pending qualification: exact-head regression/TypeScript, existing and new browser success/recovery at 390/1440, actual two-company PostgreSQL/Next ordering revision/authority/ownership races and cleanup, independent artifact/hash/image verification and final candidate/merge-tree equality. The mobile layout PR #423 must integrate first. Do not merge unqualified work or infer hosted owner access.

## Active milestone: current hosted owner access

**No current Studio owner-testing URL is qualified.** The next concrete task is to execute the qualified read-only staging inspection, then reconcile its evidence with the current source/schema and owner sign-in requirements.

Verified discovery to date:

- Default-scope Vercel discovery finds existing `helios-v2-staging`, project `prj_PUv0ADGxYl5QjRYaMv2h8Km1UmMg`, expected account `team_H79eaUfq9xMqcbf34ZCtwwn9`. Explicit scope selectors returned empty/404. The protected inspector compares both scopes using the existing runner credential; do not assume this is a missing project or recreate it.
- Git integration is connected; suppressed Preview builds are intentional. Historical protected hosted run `36217912507` succeeded for September source `2999055b2b59467fcfef446c33a47212e72d4712`, not current Studio. Its independently recovered artifact `10907013060` has SHA256 `a97ea9cc5b4b1453fe22cd9b0085803085f97e5405d0a1d46dcbd5bbf5c30437`.
- Neon connector discovery returned an internal authorization error. Current live ledger/schema are unknown. The existing hosted source admission still pins the older baseline; the qualified six-migration upgrade has not been applied to staging.
- Historical hosted fixtures used password-null synthetic owners and temporary runner-signed cookies. Persistent owner sign-in and explicit V2 workspace allowlisting still need qualification.

### Exact owner action for read-only discovery

The existing `helios-v2-staging-bootstrap` GitHub environment requires owner review, forbids administrator bypass and admits only the existing executor branch. These requirements come from `scripts/staging/policy.mjs` and remain unchanged. This session's GitHub connector has no workflow-dispatch capability. **No inspection is queued or running.**

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

## Next authorized work and boundaries

1. Inspect the live workflow state before any replay. Independently download/hash the inspection artifact and review scope results, database identity, catalog/ledger and password-readiness counts. A green diagnostic job means evidence was collected, not that hosted readiness passed.
2. Use that evidence to prepare current-source staging admission and the already-rehearsed six-migration path through the existing protected process. Stop for unknown ledger/data states or consequential credential/provider decisions; do not auto-repair or recreate infrastructure.
3. Establish persistent non-production owner login and explicit V2 workspace allowlisting, then qualify the continuous private-project flow against the hosted environment before giving the owner a testing URL. Preserve Preview limits and existing module guards.
4. Continue independent, bounded product fixes where demonstrated. Bulk media organization and unqualified outbound/module families retain their separate contracts. No general Phase 1 hardening expansion is needed.

Normal reversible non-production work remains preauthorized. Production, destructive operations, consequential security/architecture changes, billing, real providers and external customer onboarding remain owner-gated. First Light is not achieved.

## Recovery efficiency

No successful historical suite was rerun merely because this session recovered. New implementation triggered normal exact-head CI. Additional runs resolved two test defects: #419's keyboard driver raced deferred sensor setup; #420's assertions initially failed TypeScript. Final passing runs supersede those failures. A local Chromium download returned a truncated archive; local browser qualification is not claimed. GitHub checkpoints and artifacts remain authoritative, with no second project-state system.
