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
