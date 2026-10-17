# Packet 51: Referral preparation consent tokens

Referral launch previously persisted a global preference token directly while preparing each invitation. Company consent needs the same stored campaign/revision/invitation authority as the prepared message, without rewriting an existing message's payload or delivery key.

## Contract

The preparation transaction now invokes an explicit token service after creating its invitation/link and before rendering communications. The service rechecks Packet 50's owned source/lease guard, approved invitation/advocate binding, current client address and workspace membership, contact validity, newsletter suppression and scoped eligibility with protected global safety overlays.

An existing company preference or campaign company-token marker selects the company protocol. The token carries the existing v2 namespace and uses the preparation's existing random seed; its registry stores only a hash. Stored bindings include company, preference, referral campaign, invitation and approved revision. Replay with the same bound token is inert. Existing legacy campaign markers or an incompatible company revision/token identity fail closed before new communications can commit.

Legacy issuance is retained only with tenant mode off, no company preference/token selection and exactly one matching workspace under the table lock. Existing global tokens retain their original scope. Existing prepared invitations are still skipped by recovery; this service never rewrites their HTML or provider idempotency keys. Invitation and follow-up messages share the newly issued link. The existing single-company referral execution/sender containment remains in place.

## Qualification

Module tests exercise token selection, ownership predicates, protected eligibility, malformed seeds, immutable binding replay/conflicts and the actual processor's composition with invitation/follow-up rendering and stable provider identities.

Disposable PostgreSQL qualification creates invitation/link records in the actual token transaction, proves denied issuance rolls them back, tests both-direction stored ownership/revision and changed token rejection, and verifies current membership and protected global opt-outs cannot be bypassed. It then consumes the resulting token through actual public HTTP and checks company-only preference changes and stored invitation attribution. Legacy/company registry snapshots remain unchanged on rejection. No real messages are sent.

The full legacy processor is not activated in the two-company runtime; processor composition is module evidence, while token transaction/public consumption is actual PostgreSQL/HTTP evidence. Hosted/provider qualification remains separate. No schema or credential changes. Phase 1 remains open; production ON HOLD.
