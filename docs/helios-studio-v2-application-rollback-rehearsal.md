# Packet 9: isolated application rollback and routing rehearsal

## Inventory before implementation

Candidate source: #315 `ad165992518283ff72a4d3c4e2e8f888adcacbcb`. Prior source: #314 `63df1f7ba403144c9858136674b11cad8d3231f0`, overlaid with the exact #315 reviewed homepage writer bundle. Raw #314 is not a rollback target. Main remains `72dab34568cb6885f3e93b5ed9db38edca156835`. No production access is part of this work.

The rollback unit is application code/binary plus a loopback routing switch. Schema and data stay in one isolated PostgreSQL database. Both revisions use the same Prisma schema; no destructive downgrade is planned. The full migration chain contains historical backfills and provider-specific operations and is not equivalent to creating an empty schema. The rehearsal will explicitly distinguish schema initialization from migration-history validation.

Production uses PrismaNeon. Disposable rehearsal copies use generated Prisma with PrismaPg against a dedicated PostgreSQL service. Authentication, current membership lookup, route handlers, transactions, parent locks, selectors and browser editors remain real. Only database transport, external font loading and provider object verification are isolated substitutions; they are not committed runtime changes. R2 signing uses synthetic configuration and no real object transport. Media objects cannot be deleted in this rehearsal.

A local proxy may target only the two loopback processes, strips any supplied forwarding headers, records the selected application identity and never forwards to a supplied URL or production host. Both public and authenticated admin requests traverse this proxy. The private organizer is not a public-layout writer. Public host resolution uses a seeded loopback domain; tenant mode remains enabled. Cookies are signed with an isolated test-only secret and current stored membership is checked by the actual application.

The repository's Vercel configuration defines crons, not a candidate routing switch. Build script checks production migration status; this rehearsal never invokes production Vercel build/deploy or cron routes. Shared-hosted cache propagation, Vercel routing and real provider behavior remain separate gates. No production environment is loaded.

Local PostgreSQL/Docker are unavailable. Installing PostgreSQL locally failed due to the environment's package-manager permission restrictions; these are not bypassed. CI's disposable PostgreSQL service is the planned independent-connection evidence source. Preparation/build and targeted tests can run independently. Full execution results will be recorded below.
