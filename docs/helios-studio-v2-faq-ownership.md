# FAQ ownership

FaqCategory is the owned content root; each FAQ inherits ownership through its required category. Added nullable category workspace ownership with a restricting foreign key. Existing categories and old-version inserts remain intact. No automatic historical mapping or global-slug change is performed.

All category/FAQ mutations now require editor, administrator or owner access locally. New categories store authenticated ownership. Category list/order/edit/delete predicates are scoped. FAQ create/move validates destination ownership, while current FAQ predicates validate its existing category ownership. Public/admin category reads are scoped; public results still require active categories and published answers. Unassigned categories are visible only in single-company compatibility mode with the tenant flag off.

Executable route tests cover every unauthorized mutation and foreign source/destination categories. Isolated SQL tests verify legacy writes, new ownership, invalid references and restricted deletion. Full tenant activation requires a verified category mapping and tenant-aware slug uniqueness. Database concurrency, browser editing and published-page/structured-data verification remain gates. No legal content, existing FAQ data, production migration or deployment was changed.
