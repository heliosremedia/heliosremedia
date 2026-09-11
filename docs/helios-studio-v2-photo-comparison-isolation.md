# Photo comparison tenant boundaries

Status: draft implementation. Public layout, gallery hotfixes, provider adapters and production state are unchanged.

Photo Finishes already had an owned page root, but its image validator accepted the broad legacy `site/photo-comparison/` prefix, its mutations did not check editor permission, and its empty-page fallback supplied Helios examples and pricing.

This change requires editor access for saving and presigning, registers new uploads under `workspaces/<company>/photo-comparison/`, and validates registry identity before changed images reach object-head checks. URLs for new managed keys are derived on the server. An existing legacy image can remain only on the same scoped detail/pair reference; another company's identifiable old or new namespace is rejected. Pair IDs are matched only against the authenticated company's page. Arbitrary new external URLs and copied legacy keys are rejected.

Empty or partial tenant content does not inherit Helios copy, pricing or images. The legacy defaults remain only for a single matching workspace with tenant mode disabled. Known foreign namespaces in stored image keys/URLs are filtered from reads. An incomplete tenant page with no detail image or active owned examples does not publish. This filtering is not a complete historical asset attestation: shared legacy references still require reconciliation.

Saving locks the workspace before replacing its page/pairs and rechecks the read timestamp. The current editor submits its timestamp to reject stale saves, and receives saved pair IDs for subsequent edits. Old clients without a timestamp retain compatibility, so they do not gain full optimistic conflict protection. Pair replacement remains transactional. Storage objects are not deleted.

New comparison pairs start with an upload placeholder. The manager adopts the saved page response, preserving repeated saves after regenerated pair IDs. No public page layout was edited.

Local executable policy/helper/handler tests cover foreign old/new namespaces, canonical URLs, legacy defaults, empty tenants, malformed historical references, editor access, conflicting updates, scoped replacement and registered presigning. The source contract for editorial-style support remains intact. Hosted locking, real upload/save/reopen and browser layout checks remain release gates. Registry adoption does not certify actual file bytes, one-time signed URLs or complete asset usages. No live R2 operation or migration was performed.
