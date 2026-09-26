# Packet 19: real runtime request isolation

September 26, 2026. Packet 18 PR #325 passed exact-head regression run `36248414205` at `c8a6836524076d3dcd246215dfe7d8aadf457d7f` and merged into the non-production base at `a948ac3f1bf1b7642a4a0f1fecf87ab8f85f8a72`.

## Scope

The new branch-only CI workflow builds and starts the actual Next application in production mode against a disposable PostgreSQL 16 service. It extends the earlier synthetic request-adapter tests to actual HTTP, generated Prisma and PostgreSQL. No deployed test endpoint or authentication bypass is added.

The runner archives the exact committed application into a temporary directory. The only application substitutions are PrismaNeon to PrismaPg for loopback PostgreSQL and offline font variables instead of Google font downloads. Application routes, host resolution, sessions, memberships, writes and Next invalidation run unchanged. This remains isolated runtime evidence, not hosted Vercel/Neon transport, CDN or browser-router-cache qualification.

## Safety and data

- Only the fixed synthetic `helios_packet19` database on `127.0.0.1:55439` is admitted; an existing public table blocks execution before schema creation. No reset, drop or repair operation exists.
- Schema creation uses `prisma db push` only after that empty disposable-database check. This is not a migration-ledger rehearsal and cannot target staging or production.
- Child processes receive an explicit environment allowlist containing fixed synthetic settings, never inherited provider/deployment credentials. Runtime environment files are rejected.
- Two synthetic workspaces, admins, memberships, domains, settings, projects, services and media references are seeded. Media references are local dummy URLs; no upload or provider operation is part of the test.
- HTTP connects only to an explicit loopback origin, supplies the real Host header and does not follow redirects. The signed sessions use the actual token implementation.
- Membership/session-version changes are restored in finally blocks. Server processes and temporary source copies are cleaned up. The CI service owns the disposable database lifetime.

## Required assertions

Alternating and concurrent public reads must preserve both tenant identities despite hostile forwarded/workspace headers. For each tenant, a valid session presented on the other public host must retain its database membership scope. Foreign writes return 404, a valid current-revision write returns 200 with the authoritative acknowledgement, stale writes return 409, and the other tenant's row remains unchanged. Subsequent public reads must show the committed title only to its owner.

After membership revocation, the same signed session must receive a private-page login redirect and API write rejection; the other tenant remains accessible. An incremented session version invalidates the old cookie. Anonymous writes return 401. Unknown public hosts must fail without either tenant's content. Postflight checks unchanged column schema fingerprint, two workspaces and restored synthetic access state.

Local preparation, three safety/transport tests, TypeScript and scoped lint are recorded with final exact-head CI on the PR/run claim. A successful run emits `release-evidence/request-isolation.json`, binding the candidate SHA, explicit substitutions and assertion results. Artifact contents must be inspected before claiming runtime qualification complete.

Phase 1 stays open for remaining surfaces and hosted coverage. The reviewed Project slug is still globally unique; this packet uses distinct project slugs and does not claim duplicate-slug public project routing. Production ON HOLD; no deployment or production migration.
