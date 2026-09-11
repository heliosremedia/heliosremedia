# Communication group ownership expansion

Development branch only. Production release remains on hold for completed implementation and QA with Jake.

CommunicationGroup now has nullable workspace ownership with a restricting foreign key. The additive migration preserves old application inserts and existing safety groups. New manually created groups record session ownership. Rename/delete predicates require matching ownership; legacy null ownership is compatible only with one matching workspace and tenant mode disabled.

Membership editing checks both group ownership and every requested client's workspace membership. Mixed-company batches fail before mutation. Existing system-group restrictions remain, including removal from the explicitly workspace-keyed bounce group. A null-owned legacy bounce group is accepted only by its exact workspace system key; contradictory non-null foreign ownership is rejected.

Client and email directory audience lists, newsletter group options, and referral options scope groups, clients and membership counts. Newsletter recipient resolution requires both group ownership and client membership. Newsletter series creation/update validates selected groups and individual recipients; updates scope the target series before revoking approvals or changing schedules.

## Evidence and limits

Executable route tests cover foreign groups, mixed-client batches, system restrictions, own writes and bounce removal. Executable series tests reject foreign series/group/client selection before downstream mutations. PGlite executes the migration and checks preserved legacy writes, owned inserts, invalid owners and restricted deletion. These are isolated tests, not authenticated hosted HTTP/browser verification.

No group backfill is inferred. Existing unsubscribe/bounce group writers and global consent semantics remain unchanged. Global normalized-name and system-key uniqueness is retained. Full tenant activation requires explicit verified group mapping, client-membership reconciliation, consent design and conversion of all remaining consumers. Membership validation/write concurrency still requires transaction/locking review. Campaign ownership, client sync visibility and newsletter lifecycle mutations remain separate open work. No customer communications or production migrations were executed.
