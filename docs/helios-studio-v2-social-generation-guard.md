# Social AI generation ownership and stale-result guard

Status: draft implementation. Both model calls were mocked in verification; no paid generation, live post, token or provider configuration was used.

Social generation previously read a campaign, marked it running unconditionally, and later wrote variants globally. A slow result could overwrite intervening edits or retain approval metadata from an earlier revision.

Generation now claims the exact company/campaign/request under the transaction editor guard. Foreign campaigns/variants, archived content, concurrent running requests and lost conditional claims fail before model access. Successful repeated requests remain idempotent. The completion transaction rechecks actor access and the running request, then applies every chosen variant through the shared content editor using its captured version. The editor participates in the outer transaction, so the group of variant edits and campaign completion stay together. Intervening edits, revoked access or active publishing prevent application of the result. AI cannot assign approval or publication state through its output.

Failure recording is conditional on the same company, request ID and running state, so a late failure cannot replace a newer request's status. Provider calls and the grounding/verification sequence remain outside database transactions. Existing model choices, timeouts and factual-grounding rules were preserved.

The model prompt names the stored workspace. New tenant Social Studio settings use neutral audience and company language rather than Helios/Northern Colorado defaults. Sole-company legacy defaults and already-saved settings remain unchanged; historical defaults need explicit review before onboarding another company.

Verification: 513 automated tests pass, with non-incremental TypeScript, focused lint and diff checks. Executable helpers and a route with mocked model responses cover claims, duplicate/stale/foreign requests, late failures, company identity, rejected completion and successful guarded completion. Grounding and human-review source contracts remain intact. This does not prove model quality, authenticated browser behavior or multi-connection database rollback/locking.

Remaining gates: generation requests have no lease/heartbeat or automatic recovery after process death; interrupted RUNNING requests need the shared job foundation. Request IDs retain legacy global uniqueness. Publishing creation/execution still needs current-approval and relationship checks. Existing stored AI context and copied campaign relationships require the broader ownership audit. Production stays on hold.
