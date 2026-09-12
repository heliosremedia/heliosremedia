# Newsletter delivery evidence review

Status: draft after #275. Read-only API and service implementation. No provider lookup, mutation, migration or deployment is part of this milestone.

The administrator delivery-review endpoint reads a coherent transaction snapshot after fresh administrator authorization. Edition selection uses stored company ownership. The campaign, revision and all attempt ownership must agree before a report is returned. The existing single-company Newsletter gate remains active. Responses disable caching and omit email addresses, preference tokens, provider keys and provider receipt IDs.

The report distinguishes accepted evidence, uncertain attempts, receipt conflicts, rejected-only observations, historical send records and absence of recorded attempts. Invalid or foreign references block repair suggestions. Multiple different accepted receipt IDs and disagreement with a recipient's stored provider ID are conflicts. PREPARED and UNCERTAIN observations remain unresolved even when another attempt was accepted. A historical SENT record or missing attempt never establishes that a new send is safe.

The report may identify recipient records that disagree with unambiguous accepted evidence, but it performs no repair and always denies automatic retry authorization. The result is an observation at the returned edition version, not permission to change records later. Reviews exceeding 5,000 recipients or attempts require a future paginated workflow rather than returning incomplete evidence as complete. Oversized, unresolved and unavailable reviews return bounded errors.

Verification is recorded in the progress ledger. Executable tests exercise the real report classifier, transaction service and GET handler using fake database dependencies. Browser presentation, hosted transaction behavior, provider lookups, explicit reconciliation audit history, repair conflict checks and safe execution recovery remain unfinished. No historical evidence is rewritten.
