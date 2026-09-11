# About content and team profile ownership

Added nullable workspace ownership to AboutPageContent and TeamMember, with restricting foreign keys and one About record per assigned workspace. Historical content and old writes remain intact. Shared singleton targeting now supports both About and site settings while retaining the existing settings helper export.

About and team editing/reorder/deletion require editor access locally and use company predicates. New records store ownership. New images and portraits use company namespaces; mutation paths derive canonical URLs and preserve only unchanged legacy attachments. Replaced/deleted profile images are retained pending usage/recovery evidence.

Public/admin reads are scoped. Tenant-mode missing About content returns an empty configurable template, with no Helios founder copy or image fallback. Public About images are rendered only when configured. Legacy mode retains the existing Helios defaults and static imagery. This is content isolation, not the completed white-label metadata/copy audit; navigation, default metadata and other template strings still require Phase 5 review.

Executable tests cover route authorization, foreign portrait keys before storage, tenant fallback isolation and additive SQL preserving legacy content while allowing independent About rows. A failing fallback test exposed empty strings in nullable image fields; replaced the generated fallback with an explicit typed empty template. Hosted browser editing, real upload/MIME validation, historical mapping and rollback-compatible upload namespaces remain gates. No production content or object changed.
