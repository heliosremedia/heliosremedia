# Helios Studio V2 brand asset ownership

Testimonials and trusted logos are reusable company assets. They now belong directly to a workspace so each white-label company controls an independent library.

The migration preserves current Helios records. A testimonial linked to an imported Google review inherits that review's workspace; remaining legacy testimonials and logos inherit the configured legacy workspace. Before assigning manual assets, the migration requires an explicitly verified workspace ID through the migration connection setting `helios.legacy_brand_workspace_id`. Missing or nonexistent IDs fail closed, even if default site settings identify a workspace. No oldest-workspace fallback remains.

Public pages resolve these assets from the request hostname. Studio pages, mutations, reorder operations, deletes, direct uploads, and presigned uploads require editor access and use the authenticated workspace. Cross-workspace IDs return a not-found response and cannot be used to mutate or delete another company's asset.

The migration has been exercised against PostgreSQL-compatible PGlite with two companies, legacy manual assets, an imported review owned by the second company, foreign-key enforcement, and delete cascading. Production migration remains gated on a backup, hosted preview validation, and a reviewed deployment window.

## Explicit mapping and release restrictions

An operator must inventory manual testimonials and logos and verify that every unmapped row belongs to the chosen workspace. Mixed legacy ownership requires a reviewed per-record mapping before this migration can run. The connection setting is evidence input, not proof that the operator selected the correct owner.

The isolated rehearsal uses `SET helios.legacy_brand_workspace_id = 'helios'` on its synthetic database connection. Do not copy that synthetic ID into production. A hosted rehearsal must prove the verified setting reaches the exact connection executing Prisma migration SQL, including any pooler behavior. Do not add a guessed default or persist a database-wide setting as a shortcut.

This edits an unpublished draft migration. Confirm it has never been applied in any target environment before adopting the changed checksum; otherwise use an additive corrective migration instead.

Production builds currently execute `prisma migrate deploy`. This branch must not be merged into a deployment-bound branch until controlled migration execution is established. Required ownership columns still reject old application writes without workspace IDs. Old/new overlap, rollback compatibility, backup restoration and hosted verification remain unresolved. Storage attachment and cleanup ownership are also incomplete; database predicates alone do not close those paths.

## Storage compatibility

New uploads use `workspaces/<workspaceId>/testimonials/` and `workspaces/<workspaceId>/trusted-logos/`. Upload routes take workspace identity only from the authenticated session and generate the destination. Mutation paths reject cross-workspace keys and derive managed URLs on the server. Legacy images remain usable only as unchanged attachments on their current authorized record. New URL-only images require upload; existing URL-only images can be retained.

Physical cleanup is deferred, with the existing cleanup-pending response populated. No automatic cleanup job exists yet. Do not purge retained objects until an asset registry, usages and recovery policy prove deletion safe. This deliberately retains storage and requires later garbage collection. Old application versions cannot accept the new key namespace; rollback and deployment overlap need a compatibility release before production activation.
