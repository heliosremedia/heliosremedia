# Packet 14: non-production access and authenticated provenance inventory

**Outcome B: access remains insufficient. No safe hosted target was identified.** Production ON HOLD. Base #320 `1a09a9546aab41e96db0b65e22c9eb52d1b49a19`; main `72dab34568cb6885f3e93b5ed9db38edca156835`. No deployment, database access, credential modification or next packet.

## Authenticated access evidence, September 19, 2026

The connected Vercel list_teams call returned Helios Real Estate Media, slug `helios-real-estate-media`, ID `team_H79eaUfq9xMqcbf34ZCtwwn9`. Its list_projects call returned an empty project list and count0. This confirms team-level discovery works, but does not prove any project is absent or identify the cause of missing project visibility. The teams response included pagination cursors; the exposed connector has no cursor argument. Exhaustive discovery of other accounts is not claimed. No speculative project lookup or repeated setup instructions followed.

Only presence booleans were checked: no Vercel CLI, VERCEL_TOKEN or NEON_API_KEY is available. No Neon connector is exposed. OAuth scope/role and mutation capability are unknown; GET capability does not establish read-only credential scope. No token, auth file, environment values, connection string or unrelated credentials were extracted. Machine-readable observed evidence is `helios-studio-v2-hosted-access-inventory.json`.

| Resource | Established | Unknown / blocked |
| --- | --- | --- |
| Vercel account | Authenticated connector sees one team | Other pages/accounts; exact granted scopes |
| Projects | Empty result for the known team | Project IDs/names, Git integration, environment boundaries |
| Deployments | None queried | IDs, source SHA, READY state, timestamp, URL, aliases and immutable artifact correlation |
| Domains/providers | No target available to inspect | Production domain/alias or credential contamination cannot be excluded |
| Database/Neon | No available connector/API key | Project/branch/database/owner/privileges, isolation, ledger and schema |
| Safe target | **No** | Mutation and disposable/reset qualification are unproven |

Repository inventory is unchanged: Prisma config loads dotenv/DIRECT_URL; runtime PrismaNeon uses DATABASE_URL. Those are configuration names, not verified hosted bindings. vercel.json defines crons, not environment safety. Package build still rejects hosted/release markers before commands. No workflow deploys Vercel. #319 isolated manifests and #320 synthetic provider adapter remain unchanged. Existing CI uses synthetic loopback PostgreSQL configuration; it is not hosted database evidence.

## Executable implementation

`access-provenance.mjs` adds a minimal real REST **read-only inventory** transport, exercised with injected responses because a direct token is unavailable. It accepts a token explicitly, never loads dotenv, and can call only fixed-origin GET `/v2/teams` and `/v9/projects?teamId=...`. Redirects are rejected, team identifiers are validated before URL creation, fetch plus JSON settlement is bounded, and failures are never automatically retried. Provider response bodies are not logged or persisted; only validated project IDs and safe reason codes leave the boundary. A visible project still returns TARGET_QUALIFICATION_REQUIRED, never deployable.

`access-inventory-cli.mjs` accepts only explicitly named HELIOS_READONLY_VERCEL_TOKEN and HELIOS_INVENTORY_TEAM_ID. With no credentials it makes zero network calls, emits NO_CREDENTIALS and exits2. It does not reuse a generic production VERCEL_TOKEN. The dedicated workflow is **workflow_dispatch only**, performs this GET inventory, and has no deployment/mutation mode. It references a separately supplied secret but does not create that secret or prove its scope. A blocked receipt produces a failed workflow deliberately. The workflow was not invoked with hosted credentials in this packet.

`qualifyProvenance` checks normalized test snapshots for stable team/project/deployment identity, explicit preview target, READY state, source SHA, observation/deployment freshness, no domains/aliases, disposable isolated database identity/owner/provider boundaries, fresh schema/ledger evidence and role-specific artifact-upload correlation. Missing target is not preview; mutable meta SHA is not a fallback. Even a consistent snapshot returns `mode: snapshot-validation-only`, `deployable: false`, LIVE_ADMISSION_NOT_ENABLED. Caller-supplied JSON cannot authenticate itself. This is a supplemental qualification boundary, not an authenticated deployment retriever or an override to #320.

No live-to-synthetic fallback exists. The #320 adapter continues rejecting a live provider kind. No database or deployment endpoint is contacted because the safe-target prerequisite failed. Provider deployment/domain normalization and actual authenticated upload correlation remain blocked work, not silently filled with mock values.

## Trust boundary

| Evidence | Authority and limitation |
| --- | --- |
| GitHub SHA/run/artifact | Authenticated GitHub read establishes repository metadata; #319 ties local isolated builds/tests to it. Not proof of Vercel upload. |
| Release manifest | Checksum/source/build/schema receipt from trusted CI. Unsigned; mutable JSON alone cannot establish authenticity. |
| Vercel connector | Actual authenticated team/project listing only in this packet. No deployment proof obtained. |
| REST inventory transport | Fixed authenticated GET implementation; test responses are synthetic and marked as such in evidence. Token name does not certify privilege. |
| Deployment snapshot | Provider-authoritative fields must eventually be fetched and normalized by an authenticated reader. Test owner/project/source fields are expected normalized inputs, not a guarantee every API response exposes them. |
| Database snapshot | Requires separately authenticated branch/owner/isolation/privilege and actual ledger/schema inspection. No hosted evidence exists here. |
| Local expectations | Explicit reviewed IDs, role, minimum creation time and digest constrain comparisons; they do not authenticate provider or DB values. |

Official [Vercel deployment API](https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url) documents `withGitRepoInfo=true` for gitSource and explicit null target for preview. Missing target remains unknown. Source metadata alone cannot prove which #319 build was uploaded. Owner responses may contain sensitive fields, so raw provider JSON must never become audit output. Installed Next deploymentId documentation likewise describes skew/cache behavior, not provenance.

## Failure matrix and evidence

Executable tests cover missing credentials (zero calls), wrong team, project invisibility, pagination/partial metadata,401/403/404/429/500, fetch/JSON non-settlement, invalid identifiers, wrong project/deployment/team, production/unknown environment, production domains/aliases, source mismatch, stale deployment/observation, candidate/rollback role swaps, production/unknown/wrong database, real-provider credential contamination, missing upload proof and secret-safe output. Actual CLI exit behavior is tested. Every case remains non-deployable, including structurally consistent synthetic snapshots.

These are 35 targeted executable cases, added to the933-test baseline. Local full suite passed968/968. Final exact-head CI is recorded on the draft PR and canonical claim, avoiding a self-referential documentation commit. No new application UI or DB logic changed; existing regression Chromium protects those inherited surfaces. Fresh hosted browser, Neon, Vercel deployment/rollback or live mutation evidence is NOT claimed.

## Operator access checklist and exact stop

To unblock a future read-only qualification, supply through approved connectors/secret management, **never chat**:

1. Project-level read access to one explicitly identified disposable non-production Vercel project under a known team. A team listing alone is insufficient. Resolve the current empty project visibility without assuming a missing project.
2. A stable project ID and candidate/rollback deployment IDs, plus read access to source metadata and complete project/deployment domain/alias inventory. No production domain/alias; unknown means stop.
3. A separately identified non-production database project/branch/database and owner, with read-only metadata and schema/ledger access. Prove production isolation, connection privileges, disposable-data policy and synthetic-only provider configuration before any connection or mutation.
4. An independently reviewed link from trusted GitHub release artifact/build digest to the uploaded deployment. Mutable env/meta or claimed SHA alone is insufficient.
5. Complete non-production qualification and separately scoped authorization before any future mutation. This packet has no mutation path or override.

If access still yields no visible project, denied/partial metadata, unknown classification, production evidence, missing DB provenance or missing upload correlation, retain the safe reason code and stop. Do not create a project, provision a database, copy production credentials, connect a guessed URL, repair metadata or deploy to manufacture evidence.

Outcome B is a completed inventory/negative-proof packet, **not closure of the live access gate**. Code-only rollback requires no restoration. All production holds, Phase1/2 broader gates, compatibility guards and prior tests remain intact. Recommended next packet only: resolve project-scoped non-production access and obtain authenticated project/deployment/database evidence under this checklist. No next packet started.
