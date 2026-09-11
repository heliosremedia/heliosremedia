# Legal document ownership

Added nullable LegalDocument workspace ownership without changing existing document text, publication state or global type uniqueness. New documents record the authenticated workspace. Administrator/owner authorization is enforced locally. Document upsert predicates require company ownership, and publication flags update the matching company settings in the same transaction. Legacy default-settings writes are available only with one matching workspace; tenant mode uses workspace settings directly.

Admin settings reads use the authenticated workspace. Public legal-document readers and sitemap entries are scoped. Unassigned historical documents are compatible only with tenant mode off and exactly one matching workspace. No foreign legal copy is used as fallback. Also filtered sitemap hero-image references by workspace/visibility, completing the sitemap path found during the public-media review.

Global legal-type uniqueness intentionally remains until a rehearsed contract migration removes old-writer ambiguity. A second company cannot create a conflicting type until then. Verified historical ownership mapping, full settings-route audit, old/new deployment overlap and browser/SEO checks remain required. The code does not author or approve legal commitments. No legal content or production database was modified.

Tests execute actual handlers/readers with mocked dependencies and additive SQL using PGlite; they cover local permissions, company document/settings predicates, foreign published copy exclusion and preservation of old text/writes. Hosted database and browser evidence remain outstanding.
