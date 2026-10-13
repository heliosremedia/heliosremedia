# Packet 16: qualified synthetic hosted workflow

Verified September 26, 2026. Production remains **ON HOLD**.

The bounded Packet 16 hosted qualification passed. PR [323](https://github.com/heliosremedia/heliosremedia/pull/323) was merged only into `codex/v2-hosted-access-owner-action`, at `e2dedea3e1d7680798ab65ddbe2f6c8ab4b7c8d7`. This is not a main merge or production release. Earlier OPEN checkpoints remain historical evidence.

## Immutable evidence

| Item | Identity |
| --- | --- |
| Application candidate | `2999055b2b59467fcfef446c33a47212e72d4712` |
| Qualification executor | `77dfe4104ad0756c1c0aedf87f78a3ece666a609` |
| Protected run | [36217912507, attempt 1](https://github.com/heliosremedia/heliosremedia/actions/runs/36217912507) |
| Evidence artifact | `10907013060`, `staging-hosted-qualification-36217912507-1` |
| Downloaded archive SHA256 | `a97ea9cc5b4b1453fe22cd9b0085803085f97e5405d0a1d46dcbd5bbf5c30437` |
| Preview deployment | `dpl_AtCunrUq5yMk25hsfU8mBPLix59A` |
| Build digest | `f6faa3bc9c8856022f3d9f7c697d1f6ce1bdbf5d12ef76d6b3b1b84fc9f97267` |
| Receipt checksum | `c8b509b042e6f75d2289e1efe38e0392591991629b979fd111be158ded275ce4` |
| Unchanged schema hash | `500be0f2b2b62093876525ee61994200aa822fefd7f47e41dfffdba6ec0f7dad` |
| Unchanged migration ledger hash | `d6880a84f947ea721b006264466857fb7ad1649f2830b14853b360409386c4ce` |

The archive was downloaded and its SHA256 independently checked. `hosted-actions.json` reports success, no failures, and all execution/restoration/postflight phases. Deployment reached READY; receipt checks bound the expected candidate, deployment, project, team and database target.

Both `packet16-a` and `packet16-b` passed public/admin reads, anonymous rejection (401), foreign writes (404), concurrent same-revision writes (200/409), stale writes (409), authoritative acknowledgements and unchanged other-tenant rows. Hosted Chromium ran at 390px and 1440px for both tenants, with zero external requests. These claims refer to the specific tested settings/homepage workflow in `scripts/staging/actions/http.mjs`.

## Restoration independently confirmed

- Authenticated Vercel readback: staging Ignored Build Step is `exit 0` / Don't build anything; only original `DATABASE_URL` and `DIRECT_URL` project variables remain. Values were not displayed.
- Fresh Neon READ ONLY query: `calm-shape-83359560/br-young-math-arj7l4r3/helios_v2_staging`, 114 public tables, 19 completed migrations, zero incomplete/rolled-back migrations, two workspaces, two admins and two memberships. Original domains `packet16-a.example.test` and `packet16-b.example.test` restored.
- Evidence confirms schema/ledger unchanged and fixture/temporary configuration restoration succeeded.

Staging pre-production Vercel Toolbar was set Off after the preceding safe failure identified injected `vercel.live` scripts. The same candidate/executor then passed. No external-request exception or qualification assertion was relaxed. Production settings were not changed.

Exact executor CI runs `36195965648` (regression/Chromium), `36195965661` (isolated tenant/build), and `36195965734` (executor contract) succeeded. Candidate runs `36171441140`, `36171441002`, and `36171441078` succeeded. The executor's local verification reported 1,565 passing tests, TypeScript and scoped lint. These results belong to those exact heads, not later documentation commits.

## Remaining boundaries

This does not establish all-route hosted isolation, full Phase 1 or Phase 2 exit, live external-provider parity, hosted application rollback, independent final packaged function-byte attestation, FIRST LIGHT or production readiness. Cleanup of project variables does not erase existing deployment environment snapshots; credential lifetime/revocation remains an owner-controlled boundary.

The canonical charter and roadmap were reread from the verified executor before progression. [Packet 17 reconciliation](helios-studio-v2-phase-exit-reconciliation.md) separates the completed workflow from the remaining phase gates. Production deployment, migration, provider migration and real-customer onboarding remain gated.
