# Project and public media boundaries

Public project detail and metadata queries now require the resolved public workspace alongside slug and preview-project identity. A preview token for a different company's project cannot bypass the host boundary.

Homepage, portfolio and service-page hero images, portfolio thumbnails and project social images filter the related media by workspace and visible status before returning storage keys. Collection-cover relations are filtered by media workspace, and service/project join reads and counts require the project workspace. Admin homepage/project lists apply corresponding media filters. Project editor/publish checks require hero media to belong to that specific project. Thumbnail repair reads and updates only the session workspace, retaining its existing same-project hero validation.

These changes preserve layout, collection ordering, media-filter carryover, featured-project limits and existing gallery hotfixes. They do not repair inconsistent stored references or authorize changing asset ownership. Cross-project references within one company and remaining relational joins still need the full model audit and migration preflight.

Executable query tests cover own/foreign public slugs, a foreign preview token, relation predicates and workspace-scoped thumbnail repairs. Tests mock database access, so actual Prisma query execution against hosted data and browser/SEO regression checks remain release gates. No production data or deployment changed.
