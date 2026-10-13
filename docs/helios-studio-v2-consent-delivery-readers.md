# Packet 42 — Workspace-aware delivery consent

## Scope

Switch campaign and referral delivery eligibility and newsletter audience resolution to one workspace-aware reader. The workspace comes from the owned campaign/series execution context. A company requires its own SUBSCRIBED preference; another company's permission and an old global subscription cannot confer it. Existing legacy UNSUBSCRIBED/SUPPRESSED and active safety suppressions remain higher-priority blocks. Existing client membership, archived, validity and conservative shared emailSubscribed checks remain.

The single-company compatibility path retains old eligibility only with tenant context disabled and exactly one matching workspace in the database, and only when no company preference exists. Any explicit company preference takes precedence, so a company unsubscribe remains effective even in compatibility mode. Turning tenant context off in a multitenant database does not enable permissive global consent. Missing workspace fails closed. Batch reads normalize/deduplicate addresses and constrain company preference queries by workspace.

No administrator or public consent writer is activated. Legacy unsubscribe tokens keep their existing scope; company token issuance and public route integration are separate follow-up work. No provider credentials, sender identities, production deployment or hosted migration change. Phase 1 remains open; production ON HOLD.

## Qualification

Six reader tests cover both tenant flag states with multiple companies, sole-company compatibility, unknown consent and missing scope. Four composed application tests prove campaign/referral company opt-outs stop before claim/token/provider boundaries in both directions. Existing referral behavior and newsletter selection/membership tests are retained and assert the company context passed to consent.

The actual PostgreSQL reader qualification seeds independent preferences at the same address, legacy opt-out/suppression and active safety blocks. Both tenant flag states reject cross-company permission inheritance; reversing the preferences reverses eligibility. Snapshot comparison confirms no consent/contact mutations, and the tenant flag is restored. Single-company legacy behavior is module-fixture evidence, not a hosted claim. Existing token/schema/rollback/isolation checks continue. No real providers are called.

Integration requires exact-head regression/TypeScript/Chromium and disposable runtime success, independent artifact verification and a matching merged tree. This packet does not claim full delivery/provider qualification or Phase 1 exit.
