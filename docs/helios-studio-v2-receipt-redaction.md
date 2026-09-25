# Packet 16: public receipt identity redaction

Protected run `36175397618`, attempt 1, used candidate
`2999055b2b59467fcfef446c33a47212e72d4712` and executor
`5a520fa58d2270a21f2a9994ccf504ae011e3c48`. Preflight and the native
Preview build passed. Deployment `dpl_EpSf7xdQ8k66Wast7qLJ1mehqDh7`
reached READY. Receipt admission rejected `CHECK_BUILD_RECEIPT_CHECKSUM`
in phase `build-receipt`, with safe detail hash
`f1fdf1a1319af362664075876284f77f3c625d7f553731335ad78b524530d9b6`.
Hosted HTTP/Chromium and tenant isolation were not reached.

## Evidence and cause

Downloaded artifact `10882409380` matched GitHub's archive SHA-256
`3966261b29264f0202c4a42f785531b4b317c1fb3ea145248d5e564aee5785fb`.
It records completed suppression restoration, fixture restoration, temporary
configuration removal and schema/ledger postflight. Before/after hashes match:

- Schema: `500be0f2b2b62093876525ee61994200aa822fefd7f47e41dfffdba6ec0f7dad`
- Ledger: `d6880a84f947ea721b006264466857fb7ad1649f2830b14853b360409386c4ce`

Authenticated Vercel browser inspection independently confirmed the saved
Ignored Build Step is `exit 0` and the project variable inventory contains
only the original DATABASE_URL and DIRECT_URL. No values were revealed.
The deployment build log displays two redactions: receipt `candidate` and
`project` are `[REDACTED]`. The receipt checksum remains the original checksum.
Vercel documents sensitive-value redaction for values of at least 32 characters:
https://vercel.com/changelog/build-logs-now-redact-sensitive-environment-variable-values

The public Git commit SHA and Vercel project ID were incorrectly configured
using the same encrypted/secret classification as credentials. Redacting either
changes the checksummed body. This is a transport/configuration defect, not
evidence that checksum verification should be relaxed.

## Bounded correction

Only STAGING_CANDIDATE_SHA and VERCEL_PROJECT_ID use the documented `plain`
configuration type when the executor creates its temporary branch-specific
Preview variables. Both values still come from fixed reviewed policy constants.
All other variables retain their previous encrypted type. No existing secret,
team setting, environment protection, receipt field, checksum algorithm,
assertion, deployment payload or cleanup rule is changed. No masked value is
reconstructed by the verifier. No production target is introduced.

API reference:
https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables

Tests execute the actual configure callback with synthetic credentials and
transport the actual producer receipt through a model of value redaction.
They verify the exact two-key plain allowlist, unchanged credential types,
Preview/branch/run-marker scoping, checksum rejection after redaction or
tampering, and a valid round trip without credential content. The historical
AST fingerprint normalizes only this exact reviewed type expression, retaining
the existing fingerprint for all other effects and admission checks.

The application candidate and its CI evidence remain pinned. Full local and
exact-executor CI results are recorded after verification. Independent Neon
postflight and a new protected hosted qualification remain required. No retry
or Packet 16 completion is claimed by this implementation. Production ON HOLD.


## Hosted verification follow-up

Run `36182012088` at executor `2e6555d0cbcbe9b151461146e1097bf3af3a6080`
proves the receipt correction: the Preview reached READY and all receipt checks
passed. Candidate remains `2999055b2b59467fcfef446c33a47212e72d4712`.
The subsequent hosted HTTP/Chromium phase failed closed with
`IDENTITY_OR_CONTRACT_MISMATCH`, detail hash
`f3b36e73d9d882bdb9dd7302babe080354439f4087326e2b70a48f8ad59e4a71`.
Locally reproducing Node's assertion message confirms this hash corresponds to
actual HTTP 302 versus expected 200. It does not identify which request or the
redirect destination. No successful hosted tenant/browser qualification is claimed.

Artifact `10885715509` was downloaded and its archive SHA256 verified:
`f34fed1a09fcaa1c88fca520a58e90e1e561c8da5351439ce5fba99fade2d4e1`.
Its schema and ledger hashes equal the before/after hashes above. All four cleanup
phases passed; the independent Actions suppression step also passed. Fresh
read-only Neon UI query confirms 114 tables, 19 complete migrations, zero incomplete,
2 workspaces/admins/memberships, and both original example.test domains.
Authenticated staging Vercel UI confirms exit 0 and only DATABASE_URL/DIRECT_URL
remain. No production changes.

The next bounded diagnostic change wraps only the three existing expected-200
assertions with fixed labels HTTP_PUBLIC_STATUS, HTTP_ADMIN_STATUS and
HTTP_BROWSER_STATUS. Request options, redirect rejection, auth, acceptance,
ordering and cleanup are unchanged. Actual harness tests independently inject
302 at each point and verify the correct safe label, context/browser closure and
AUTH_SECRET removal. Existing both-direction success coverage is retained.


## Anonymous API boundary correction

After the owner configured the staging automation bypass credential, run
`36189494446` passed the public200 and own/foreign public content assertions.
The next anonymous PATCH returned401, while the harness incorrectly expected403.
Safe failure hash `6867b0fd71d08adeebab181d566d6a3bcada226c9502debf4edae84c7f9dad83`
exactly matches Node's actual401/expected403 assertion message.
The pinned application's existing proxy.ts explicitly returns401 with
Authentication required for unauthenticated /api/admin requests, before route
execution. The route-level403 expectation belonged to the earlier direct-route
adapter and was incorrectly carried into the hosted HTTP harness.

The correction requires exactly401 and adds fixed HTTP_ANONYMOUS_STATUS diagnostics.
It does not accept a range of statuses or modify the application, session validation,
proxy, route handler, deployment protection, tenant checks, or cleanup. Tests execute
the actual proxy source with real NextRequest/NextResponse and token verification;
the harness consumes its anonymous response. Separate failure cases reject200,302
and403 and verify context/browser and AUTH_SECRET cleanup. Existing both-direction
foreign404, concurrency200/409, stale409 and browser checks remain enforced.

Downloaded artifact10887711479 matched archive SHA256
`a34ed22000ff8c68ba2a6c59d9b73ec5f58005e27f1ba72e8caeb43dfefd6dc9`.
All cleanup phases passed and schema/ledger hashes remain identical to the baseline
above. Independent authenticated UI checks confirmed exit0 suppression, only the two
original database variables,114 tables,19 complete migrations,0 incomplete,
2 synthetic workspaces/admins/memberships and both original example.test domains.
No authenticated admin, mutation race or hosted Chromium success is claimed.
Candidate remains2999055b2b59467fcfef446c33a47212e72d4712. Production ON HOLD.
