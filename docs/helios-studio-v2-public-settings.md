# Tenant-aware public site settings

Behind STUDIO_V2_TENANT_CONTEXT_ENABLED, getSiteSettings resolves the request's public workspace and selects SiteSettings by its unique workspaceId. Missing settings, unknown hosts and database errors are propagated; they cannot return the global Helios default record. With the flag off, the existing default-record lookup and database-error fallback remain unchanged.

The non-production local workspace override now only applies to localhost, 127.0.0.1 and IPv6 loopback. An arbitrary unknown hostname cannot select that workspace via the override. Preview domains must be explicitly registered before tenant mode is enabled.

Tests exercise independent company settings, missing settings, invalid/unknown workspace resolution, database failures, legacy fallback and loopback restrictions. They do not prove full public-site isolation: other content roots, branding defaults for incomplete fields, metadata, caches, admin callers and scheduled newsletter generation still require migration. The flag must remain off until those dependent paths and hosted browser tests pass. Background jobs must eventually supply authoritative workspace context rather than depend on HTTP headers.

No migration or production configuration change is included. Rollback is the existing tenant-context feature flag. Existing data and provider integrations are untouched.
