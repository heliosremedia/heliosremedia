# Helios Studio V2 brand asset ownership

Testimonials and trusted logos are reusable company assets. They now belong directly to a workspace so each white-label company controls an independent library.

The migration preserves current Helios records. A testimonial linked to an imported Google review inherits that review's workspace; remaining legacy testimonials and logos inherit the configured legacy workspace. The migration fails instead of creating ownerless records when no workspace exists.

Public pages resolve these assets from the request hostname. Studio pages, mutations, reorder operations, deletes, direct uploads, and presigned uploads require editor access and use the authenticated workspace. Cross-workspace IDs return a not-found response and cannot be used to mutate or delete another company's asset.

The migration has been exercised against PostgreSQL-compatible PGlite with two companies, legacy manual assets, an imported review owned by the second company, foreign-key enforcement, and delete cascading. Production migration remains gated on a backup, hosted preview validation, and a reviewed deployment window.
