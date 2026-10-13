# Packet 52: Dashboard monitor context containment

The dashboard called the global UptimeRobot reader without a workspace identity. That reader cached one provider-account summary process-wide and consulted the cache before any ownership or configuration checks. A synthetic reproduction returned the same cached monitor result to consecutive callers with one provider request. This is not a tenant monitor registry and must not be presented as another company's website health.

## Correction

The dashboard passes its verified session workspace. The reader checks tenant mode and current sole-company attribution before touching cache or credentials. Tenant mode, multiple companies, a nonmatching company or missing context returns an empty not-configured summary. Database admission failure returns an empty unknown summary. Removing the provider key cannot expose a prior cached value.

Compatibility is confined to tenant mode off and exactly one matching company. Cache entries include that company's identity, including the stale-on-provider-failure path. Existing same-company caching and bounded provider timeout remain. There is no new per-tenant monitor provisioning, platform support role or provider configuration.

## Evidence

Module tests cover fresh and warm-cache admission, provisioning/flag changes after cache warmup, database failure, credential removal, foreign-cache failure fallback and preserved legacy cache/stale behavior. The initial shared-cache reproduction used synthetic data only.

The disposable Next runtime substitutes a synthetic monitor account with a distinct response-time/name/incident marker and no network fallback. Actual authenticated dashboard HTTP reads alternate companies and forged hosts, include concurrent reads, and assert no platform monitor result is rendered. Anonymous and revoked sessions must redirect, and membership restoration is checked. This is application HTTP/persistence evidence with an explicit monitor-provider substitution; it is not live UptimeRobot, Vercel/CDN or hosted credential qualification.

No production, provider credential or schema changes. Phase 1 remains open. Platform/support access design and per-company monitor configuration remain separate work. Production ON HOLD.
