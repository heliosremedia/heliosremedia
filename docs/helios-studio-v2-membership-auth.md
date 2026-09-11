# Phase 1 membership authorization

The session and workspace helpers now share a server-only membership lookup. With STUDIO_V2_TENANT_CONTEXT_ENABLED=false, they do not query the membership table. With the flag enabled, only an ACTIVE membership matching both the database-backed user and compatibility workspace grants access. Membership role overrides the legacy role. Missing records, revoked access and database failures never fall back to legacy permissions.

This slice deliberately does not change login or write membership records during authentication. Login must not recreate or reactivate revoked memberships.

## Remaining activation gates

Keep the flag disabled. Lifecycle synchronization for invitations, explicit role changes and ownership transfer still needs implementation and transactional integration tests. The earlier unpublished lifecycle draft was not shipped because login could restore revoked access. A production-like migration rehearsal and full application tenant ownership audit also remain outstanding. The synthetic resolver tests prove this authorization boundary only, not full application isolation.

No database migration is applied by this change. Existing Meta files and credentials are unchanged.
