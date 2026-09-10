# Helios Studio V2 Tenant Foundation Runbook

## Release scope

This release adds the first compatibility layer for multi-tenant operation:

- Workspace memberships alongside the legacy `AdminUser.workspaceId` and `AdminUser.role` fields
- A normalized, globally unique workspace-domain registry
- Host-based public workspace resolution behind `STUDIO_V2_TENANT_CONTEXT_ENABLED`
- A development-only explicit workspace fallback

It does not remove or rewrite legacy authorization, change Meta integrations, provision another tenant, or enable host-based resolution in production.

## Migration behavior

The migration is additive. It creates `WorkspaceMembership` and `WorkspaceDomain`, then idempotently creates one membership from every existing administrator's legacy workspace and role. Inactive administrators are backfilled as suspended members.

No existing user, workspace, token, destination, project, campaign, schedule, or publication is updated or deleted.

## Pre-deployment checks

1. Confirm the production database backup and point-in-time recovery window.
2. Record counts for `Workspace`, `AdminUser`, and current active administrators.
3. Confirm Meta connection and destination health using the protected baseline.
4. Keep `STUDIO_V2_TENANT_CONTEXT_ENABLED=false`.
5. Apply the migration in preview or a production-like database first.
6. Confirm every administrator has exactly one compatibility membership.
7. Confirm inactive administrators were backfilled as suspended.
8. Confirm no hostname records were created implicitly.

## Domain activation

Host-based routing may be enabled only after all public production hostnames are inserted as normalized `PUBLIC_SITE` domains with `ACTIVE` status and ownership has been verified.

Before enabling the flag:

1. Insert the canonical hostname and any accepted aliases explicitly.
2. Mark only the canonical hostname primary for the public-site purpose.
3. Verify unknown hostnames return no workspace.
4. Verify each configured hostname resolves only its owning workspace.
5. Verify the Helios public site, portfolio, forms, sitemap, and public APIs in preview.
6. Run cross-tenant isolation tests with two synthetic workspaces.

Do not enable the flag merely because the migration succeeded.

## Rollback

If host resolution fails, set `STUDIO_V2_TENANT_CONTEXT_ENABLED=false`. That immediately restores the existing Helios resolver without deleting domain or membership records.

The new tables should remain in place during the rollback window. Dropping them is unnecessary and would make recovery less safe.

## Exit gate

This slice is complete when the additive migration is verified, compatibility membership counts reconcile, Helios behavior is unchanged with the flag off, and host isolation passes with synthetic tenant data. A second real company must not be onboarded before that evidence exists.
