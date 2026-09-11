# CTA ownership

CallToAction now has nullable workspace ownership with a restricting foreign key; placements inherit ownership from their CTA. New CTA records store authenticated ownership. Every mutation requires editor access locally. CTA reads/writes/deletes and placement upserts are scoped, so an occupied foreign slot cannot be reassigned through its global key. Public placement lookup requires the resolved company.

The global slot uniqueness constraint remains for old-application compatibility. A second company cannot claim an already occupied slot until a rehearsed tenant-slot contract migration. A conflicting scoped upsert fails within its transaction rather than replacing the foreign CTA. Historical CTA text, booking destinations and placements are unchanged; old inserts remain supported. Unassigned roots use only single-company legacy compatibility.

Actual-handler tests with mocked dependencies cover permission gates, ownership writes and placement predicates. PGlite rehearses additive ownership and preserved destinations/old writes. Verified historical mapping, slot contract migration, actual concurrency tests and browser conversion flows remain open. Default branding copy remains part of the later white-label audit. No production migration or booking integration was changed.
