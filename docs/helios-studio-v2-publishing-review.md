# Publishing evidence review and queue containment

Draft read-only operator groundwork. This does not resolve external outcomes or authorize recovery. Production remains held.

## Ownership and safe reads

The queue previously selected jobs only through connection ownership while including campaign/variant content without checking that ownership. It now uses a server-only data-access service with fresh locked editor membership. This explicitly tightens the old any-session page to editor-or-higher operational access; viewers are denied, and administrator-only evidence inspection remains a separate threshold. This role change requires parity/QA review before rollout. A single relational query requires the campaign and connection to belong to the session workspace, matching connection/variant platforms, and a snapshot pointing to the same variant and destination. Inconsistent rows are excluded without exposing which foreign parent exists. This is containment, not a backfill or repair of historical ownership.

The existing 200-row limit and schedule ordering remain. Explicit selected columns replace broad model reads. Claim presence is a boolean, never a token. Queue diagnostics use the recorded error category instead of potentially unsafe historical error text. Public links allow only HTTP(S) without embedded credentials. Existing public URLs in storage are not rewritten. Claimed and validating jobs no longer offer client-side actions that the existing server already rejects.

## Recorded evidence, not provider truth

`GET /api/admin/social/publishing-jobs/[jobId]/review` requires fresh administrator access and the same relational ownership checks. It locks the owned job while reading at most 10 recent settled attempts, consistent with current worker lock order. The response includes job status, revision numbers, claim/reference presence, recorded times and safe attempt facts. It excludes credentials, payloads, claim tokens, raw provider references, provider responses and historical free-text errors. Responses are uncached. No POST, PATCH, provider call, retry, cancellation, audit mutation or publication mutation exists in this service.

The queue's on-demand panel distinguishes unfinished validation, unconfirmed outcomes, recorded provider processing, recorded local publication and other recorded states. A missing attempt does not prove that no provider call occurred. A local PUBLISHED status is not a fresh external check. Matching revision numbers do not prove all approval requirements. The panel has one read action, duplicate-request suppression, bounded request time, focus/status handling and clearing of stale evidence after failed access or malformed responses.

## Verification and limitations

An isolated PGlite fixture executes the actual service/authentication policy and raw SQL. It covers two companies, corrupt campaign/destination/snapshot relations, platform mismatch, revoked/editor/stale-session boundaries, bounded attempt history, withheld private fields, unsafe links, state distinctions and unchanged stored records. Prisma-shaped authorization delegates are narrow fixture adapters; this is not the complete generated Prisma/Neon client or hosted concurrency.

Actual route and page modules execute against synthetic session/service boundaries. Chromium runs the real review component against browser-only fake API responses, checking read-only requests, duplicate suppression, focus, state distinctions, access/unknown errors and mobile overflow. These are separate layer tests, not an authenticated browser-to-hosted-database session. Exact results and CI commits are in the progress ledger.

## Next and rollback

External-outcome reconciliation still requires a documented evidence source and explicit business-safe resolution contract. Do not add a generic retry or mark-published action to this inspection endpoint. Approval-reservation acknowledgement recovery, historical ownership repair, provider identity at each attempt, full queue pagination, hosted lock/latency and old/new worker overlap remain open. Phase 1 and Phase 2 exits are not satisfied.

No worker, adapter, OAuth/token, approval contract, schema, cron or production configuration changed. This UI can be hidden independently; keep the queue ownership filter if reverting the review panel. Do not restore unsafe parent reads as a rollback shortcut.
