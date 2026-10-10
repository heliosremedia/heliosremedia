# Packet 20: portfolio and preview isolation over HTTP

September 26, 2026. Extends the Packet 19 disposable Next/PostgreSQL harness without changing application code or its transport substitutions.

## Verified parent

PR #326 merged into the non-production base at `012e5343fdbca843aeb1f3f63aa14691523ff04e`. Exact candidate `69254f1d8cb9dd343429c0aab89fac564cd4d3cb` passed runtime run `36250083538` and regression run `36250083399`. Downloaded artifact `10908419107` independently matched archive SHA256 `923ea475e56d78c6fe1e2f03184507c6baeb2e88db3aa330de0646f388dc50d9`. Candidate, both-tenant HTTP assertions, column-schema fingerprint and restored synthetic access were inspected. Packet 19's isolated runtime scope is complete; it is not hosted/CDN/browser-cache proof.

## New required checks

For each synthetic tenant, exercise actual production-mode HTTP and generated Prisma:

- Published portfolio content is visible on its own host and absent on the other tenant's host.
- A project made DRAFT is unavailable without a valid preview token.
- The actual authenticated preview creation route rejects a foreign project without creating a token, and returns an owner-domain URL when called by the owner even with the other public Host header.
- The generated token renders draft content with private-preview/noindex metadata only on the owning host. A foreign-host attempt neither reveals content nor changes lastUsedAt.
- The actual revocation route rejects the other tenant without changing the preview row. Owner revocation prevents subsequent preview access and usage writes.
- An expired synthetic preview is rejected without content or usage mutation.

Tokens and URLs remain in memory and are omitted from the uploaded receipt. Project title/publication fixtures are restored in finally blocks. Preview rows are synthetic records in the disposable CI database, which is destroyed with the job service. No staging, provider, credential, migration-ledger or production operation occurs.

The workflow includes the Packet 20 branch and reruns the complete Packet 19 qualification first. Exact-head CI and downloaded artifact inspection are required before declaring this extension complete. The tests do not establish atomic membership revocation during an already-running preview mutation; that transaction boundary remains a separate review item.

Phase 1 remains open. Production ON HOLD.
