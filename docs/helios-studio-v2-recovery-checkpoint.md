# Studio V2 recovery checkpoint

Updated October 17, 2026. **V2 production ON HOLD.** Live GitHub is authoritative. Routine reversible non-production implementation, testing, fixes and qualified merges remain authorized without routine continuation approval. Preserve protected-environment review and all existing access controls.

## Live recovery and current work

- Recovered integration `codex/v2-hosted-access-owner-action` at `f614f6bfa626266e99e72c4e3cf325e894711a2a`. Latest code integration is #441 at `2f890c32d6ba627e3af49c294f15b7fb61773394`; subsequent commits were documentation only. Latest completed documentation regression `38440732072` succeeded. No interrupted unmerged product implementation was found in the recent PR inventory.
- Completed migration `38336325763`, owner credential initialization `38416979449`, and persistent Preview qualification `38417689573` must not be repeated. Fresh GitHub run metadata confirms credential and Preview success; retained independent artifact evidence is below. Recovery did not rerun these operations.
- Public homepage hotfix is separate: PR #443, candidate `80b590306c8781190398ec06ec8fdd3160338d28`, is based on verified production source `72dab34568cb6885f3e93b5ed9db38edca156835`. It changes only mobile Hero alignment/header clearance. Eight Chromium viewport checks, scoped lint and whitespace validation passed; desktop geometry is unchanged. Prepared only, not merged or deployed. V2 source/migrations are excluded. Production deployment `dpl_CcUjMpNxnxE9Vcdc8TMyYsQpEcCz` was verified through the Vercel API.
- Active non-production product work: first-project guidance for empty workspaces, distinct filtered-empty recovery, and disabled empty-list selection. No server action, authorization, schema or provider behavior changes. Qualification and integration status must be recorded before this slice is called complete.
- Next useful milestone remains integrated owner testing: exercise inquiry → private project → details/media/services → private review, fix observed workflow defects, and make core workflow entry understandable to a fresh owner. Hosted access is complete; real-company provisioning, live providers and First Light remain unqualified.

## Historical record

The previous checkpoint mixed completed evidence with obsolete instructions to initialize credentials or dispatch Preview again. Those instructions are retired. Full immutable evidence and earlier failures remain in the [October 13 checkpoint](https://github.com/heliosremedia/heliosremedia/blob/f614f6bfa626266e99e72c4e3cf325e894711a2a/docs/helios-studio-v2-recovery-checkpoint.md) and progress ledger. Historical waiting states are not current action items.

## Completed hosted-access milestone — October 13, 2026

**Persistent synthetic-owner login and current-source staging Preview are now live-qualified.** Protected run [38417689573](https://github.com/heliosremedia/heliosremedia/actions/runs/38417689573) completed successfully after actual owner review. This section supersedes historical waiting, missing-password and no-testing-URL statements in the archived record. Production remains ON HOLD; provider activation, real tenant onboarding and First Light are not qualified.

- Application source: 2f890c32d6ba627e3af49c294f15b7fb61773394 (#441). Executor: 9e7dcfc4611ed21e19d7fc1b7a42ff1da109c68d (#442). The retained hosted Preview stays on this source. Newer product changes require separate future Preview qualification; integration alone does not update this deployment.
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
