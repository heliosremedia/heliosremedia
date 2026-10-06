# Packet 45 — Company administrator consent activation

## Boundary

The administrator preference route now selects the scoped writer when tenant mode is enabled or a company preference already exists. It first checks current administrator authority and owned client selection in a read transaction, ends that transaction, then calls the existing scoped writer. That writer independently locks and rechecks current actor/client authority and commits preference/history/required audit atomically. There is no nested transaction holding the workspace lock while waiting for another writer.

Without tenant mode or an existing company preference, the restrictive legacy path remains: a sole matching workspace, attributable contacts, table locks and protected safety checks. Multiple-company legacy mutation still fails closed. Foreign clients remain 404. Confirmed consent and a documented source remain mandatory; protected global opt-outs/safety blocks return a generic 409 and cannot be released by this action. No shared contact flags or global preferences are changed by company actions.

The directory receives its server-derived company-consent mode. UNKNOWN/PENDING company consent uses the existing explicit consent-source and confirmation flow; legacy UNKNOWN keeps its established unsubscribe action. Confirmation copy names this company's scope. React review keeps the action derived from current props, avoids new effects/fetches and preserves existing busy/confirmation controls.

## Qualification

Fifteen composed service/route and action-policy tests retain foreign-client/current-role/legacy transaction/audit failure coverage and verify delegation with confirmation and no legacy writes. TypeScript, scoped lint, syntax and source preparation are local gates.

The real HTTP administrator qualifier exercises foreign-client 404, protected resubscribe 409, company write 200, shared-address independent opt-outs and inert replay in both directions. Revocation/demotion is applied after observing the request waiting on the workspace lock; it returns 403 without mutation. Required audit cancellation is observed on the database backend and yields sanitized 500 with preference/history/audit rollback before successful retry and replay. Legacy/safety/contact snapshots remain unchanged; membership and injected trigger/function state are restored.

The additive schema qualifier runs before administrator HTTP mutations so it still verifies initially empty company-consent tables and the checked-in migration. No schema gate is skipped. Existing public-token and directory qualification continue after administrator checks. Exact-head CI, independent artifact inspection and merged-tree equality remain integration gates.

Delivery token issuance, analytics attribution and broader Phase 1 exit reconciliation remain follow-up work. No providers, hosted migration, production deployment or customer onboarding. Production ON HOLD.
