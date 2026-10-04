# Packet 39: additive company consent storage

## Approved contract

Following Jake's October 4 non-production approval and Packet 38 administrator containment, add WorkspaceMarketingPreference, WorkspaceMarketingPreferenceEvent and WorkspaceMarketingPreferenceToken. The existing global preference, history, token and safety-suppression tables remain unchanged, with no data conversion or backfill.

Preferences are unique by company and normalized address. History and tokens have required company identity and composite foreign keys to the preference's (workspaceId, id), so a child cannot claim Company A while referencing Company B's preference. Ownership-key updates and deletes are restricted. The new consent status enum excludes SUPPRESSED: platform safety remains separate.

Tokens retain only a hash, expiry, last-use time and provenance identifiers. Token hashes remain globally unique because public bearer-token resolution must be unambiguous; future generation must use server-generated cryptographic entropy, never a caller-supplied request ID. Actor/message/campaign identifiers are provenance fields, not authority. Future writers must validate their ownership and current access before use.

## Migration qualification

Prisma's offline schema diff generates only one new enum, three new tables, their indexes and foreign keys. The checked-in SQL is transactional and never rewrites legacy data.

The disposable harness requires the three new tables to be empty, reconstructs the prior schema by removing only those empty synthetic tables, then applies the checked-in SQL. It compares columns, indexes and constraints with the declared Prisma schema. Seeded legacy opt-out, history and token rows, existing safety blocks, client projections and group memberships must remain unchanged throughout.

Both tenants may store different preferences for the same address. Both-direction negative inserts must fail at the actual PostgreSQL composite foreign key for history and tokens. Duplicate addresses within one company must fail uniqueness. Owned history/tokens and owned preference edits must succeed while the other company's preference remains unchanged.

## Limits and progression

This packet activates no application reader, writer, public token endpoint or delivery decision. Unknown/new preferences grant no authority by their existence. The global compatibility overlay and safety-preserving application adapters are the next bounded work. Existing public legacy-token behavior remains unchanged. Legacy consent attribution is not inferred from current client membership.

Prisma validation/generation, TypeScript and script syntax checks precede publication. Exact-head regression, runtime and independently downloaded evidence are required before integration. No hosted or production migration is performed. Production ON HOLD; Phase 1 remains open.
