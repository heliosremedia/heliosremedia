# Helios Studio V2 homepage tenant isolation

## Risk closed

Homepage curation previously accepted project, service, card, placement, and media IDs without consistently proving that they belonged to the signed-in workspace. The mutation routes also lacked their own authorization check. In a white-label deployment, a user who learned another company's identifier could have attempted a cross-company read or mutation.

## Enforcement

- Homepage project and work-card routes require an active Studio session with owner, admin, or editor access.
- Every read, reorder, update, delete, and upload-presign operation includes the session workspace in its database predicate.
- Selected projects and media must be published or visible according to the existing product rules.
- Public homepage curation is filtered by the workspace resolved from the request host.
- A work card whose featured media belongs to another workspace is omitted from public and admin reads. This quarantines inconsistent legacy data rather than exposing it.
- Admin settings are loaded using the authenticated workspace ID. Background and admin callers do not infer ownership from the public request host.

## Verification

The focused test suite checks route authorization and scope contracts and executes representative relational queries against isolated PostgreSQL-compatible PGlite data for two companies. It confirms that Helios cannot see a competitor's homepage project, service card, or media, including a deliberately corrupted cross-workspace media association.

The change is additive at the application layer and does not alter production records or the working Meta connection layer.
