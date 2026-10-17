# Packet 78: featured-film attachment authority

Status: candidate pending exact-head qualification. Phase 1 OPEN; production ON HOLD.

Two executable reproductions on the Packet 77 head accepted a newly quarantined video or poster after provider inspection (200 instead of 400). The save already rechecked current actor, settings ownership and revision, but its asset registry checks ran only before the transaction.

The fix calls the existing locked registry verifier for both video and poster inside the existing settings transaction, after current actor/target checks and before mutation. Provider inspection stays outside the transaction. Scoped namespace/owner/status rules, exact unchanged legacy references, null clearing, response projection, revision acknowledgement and retained provider objects are preserved.

The real HTTP/disposable PostgreSQL harness requires eighteen observed lock waits across both tenants: revoked/demoted/stale actors, video/poster quarantine or owner changes, settings owner change and concurrent revision change. It also checks foreign attachment denial, transactional rollback, concurrent single-winner revision saves, acknowledgement scope, unchanged foreign settings/registry and legacy/clear compatibility. Provider HeadObject is a reviewed synthetic no-network substitute; this does not qualify hosted object delivery.

Local regression/TypeScript/scoped lint, exact-head regression/Chromium and isolated runtime, independent artifact download/hash/parse verification and merge-tree equality remain integration gates. Support evidence inherited from Packet 77 must remain passing. No new schema, real enrollment, provider mutation or production action is included.
