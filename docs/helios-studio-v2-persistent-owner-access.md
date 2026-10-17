# Persistent synthetic-owner access

Production ON HOLD. The completed staging upgrade run 38336325763 must not be rerun. Its independently verified receipt records the current 25-entry schema/ledger, preserved existing data and repeat no-op. This work prepares the next non-production gate; it does not claim a hosted testing URL.

## Credential initialization

The runner initializes only existing `packet16-a-owner` and `packet16-b-owner` accounts, with ordinary sign-in emails `packet16-a@example.test` and `packet16-b@example.test`. No person is enrolled and no production user is touched. Passwords come only from protected environment secrets `STAGING_OWNER_PASSWORD_A` and `STAGING_OWNER_PASSWORD_B`, distinct dedicated 24–256 character values. They are never workflow inputs, command-line arguments, logs or artifact content. Hashing and verification use the application's actual `lib/auth/password.ts` implementation.

Admission requires the exact current catalog and all 25 individual migration checksums, the original seven-table two-company footprint, active OWNER memberships and workspaces, unchanged passwordless owner state, and the original unbound synthetic hostnames. A shared staging advisory lock and transaction table locks serialize initialization. Both credentials commit together; all other rows and the entire schema/ledger must remain identical. Session versions increase from 1 to 2 to invalidate previously issued synthetic sessions. Existing credentials block replay, rotation and automatic repair.

The live entry requires an exact checked-out qualified candidate, successful exact-source regression and owner rehearsal runs, the existing manual executor workflow/ref, exact staging confirmation and named owner confirmation. It independently checks the protected environment's owner reviewer, no-admin-bypass and exact branch restriction, plus Neon project/branch/database ownership, ready state, PostgreSQL16 and certificate-verified direct TLS connection. Only fixed phase names are retained on failure. An uncertain commit or missing receipt requires read-only inspection, never automatic redispatch.

## Qualification and remaining execution

The isolated rehearsal follows the existing disposable PostgreSQL current-upgrade rehearsal. It seeds only disposable synthetic rows, tests concurrent-lock rejection, inactive-membership rejection, catalog drift, rollback after the second-owner update fails, replay rejection and credentials surviving reconnect. Receipt output contains public fixture identities and schema/ledger hashes, never password material. It expressly reports hosted:false and ownerAccessQualified:false.

This source does not register or dispatch a new live workflow. After exact-source CI and independent artifact inspection, the separate protected executor must pin this qualified source/run evidence and add the named credential-initialization track to the existing workflow. Preserve the existing environment review. Required password secrets must exist before live execution; their values must not be pasted into chat. Registration must not merge the old executor application baseline into the current integration line.

After live initialization, current-source Preview work must retain a stable dedicated staging AUTH_SECRET, exact two-workspace shell allowlist, provider restrictions, Preview-only source/target provenance and existing access controls. Verify ordinary sign-in, reload, logout and tenant isolation against actual provider-owned hosts. Keep automatic build suppression. Historical qualification restores temporary configuration/host bindings and cannot serve as evidence of a persistent testing URL.
