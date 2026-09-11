# Brand ownership expansion compatibility

Status: local implementation for the draft stack. No hosted migration or rollout.

The initial brand migration required ownership immediately, preventing the old application from inserting testimonials and logos during overlap. This revision keeps those columns nullable. New application creates still write the authenticated or stored workspace. Reads and mutations admit null ownership only with tenant mode disabled and exactly one matching workspace. Tenant mode and multi-workspace installations exclude null ownership. Review curation continues to reject unassigned linked testimonials until reconciliation.

The existing verified legacy mapping requirement remains. Neither settings nor workspace age supplies an owner. Brand foreign keys now restrict workspace deletion rather than cascading content removal. The global external-review unique index is retained during expansion so legacy unique lookups remain unambiguous. Removing it requires the separate contract release and blocks duplicate provider IDs across companies until then.

`scripts/migrations/backfill-brand-ownership.sql` is an operator-only transaction, separate from migration deploy. Prepare the documented temporary mapping table on the same connection using verified record evidence. It locks the relevant tables, rejects unknown records/workspaces, reassignment, incomplete mapping and cross-workspace review links. Repeated runs with the same mapping are safe. It does not impose NOT NULL or enable tenant mode.

## Release sequence and remaining gates

1. Verify target `_prisma_migrations` history before using this revised draft migration. The handoff says no production V2 migration was executed, but target history is not independently verified here. If the previous checksum exists anywhere, stop and prepare a forward migration for that target; never rewrite migration history or mark it resolved to hide a mismatch.
2. Rehearse backup restoration and expansion on an isolated hosted database using representative records and explicit legacy mapping. PGlite evidence does not replace this gate.
3. Keep tenant mode disabled and the installation single-company during old/new overlap. Old code has global queries and cannot safely serve a second company. Keep second-company provisioning blocked until old instances and jobs have drained.
4. Deploy the ownership-writing compatibility application. Verify actual old/new creation, save/reopen, image uploads and public rendering. Old validators do not understand the new workspace storage paths, so arbitrary old-version rollback is not supported. Prepare and test a rollback application that understands both namespaces while preserving ownership enforcement.
5. After old writers drain, reconcile remaining null records using explicit per-record mapping. Run the review relationship preflight. Verify no null ownership and no legacy writers return before a separately approved/rehearsed NOT NULL contract release.

Local SQL tests demonstrate omitted-column old inserts, retained records, foreign-key enforcement, restricted deletion and mapping atomicity. Scope and route tests cover strict tenant behavior and owned attachment checks. No application-overlap browser test, real upload, Neon lock test or production action has occurred. Global old-code queries, rollback namespace compatibility, hosted migration history and final contract remain release blockers.
