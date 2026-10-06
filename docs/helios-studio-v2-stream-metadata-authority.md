# Packet 59 — Stream upload metadata authority

The initial Stream upload request previously forwarded browser metadata verbatim before appending server duration and expiry. This admitted duplicate reserved keys and other provider controls. No provider override behavior is assumed or claimed: the local authority boundary itself was incomplete.

The route now accepts only the four descriptive fields emitted by the existing uploader: `filename`, `filetype`, `name`, and `uploadPolicy`. It rejects unknown, duplicate, malformed or noncanonical base64 metadata with a generic 400 before project lookup, asset registration or provider access. Empty values and Unicode values encoded as base64 remain supported. A bounded 8 KiB header is sufficient for these descriptive fields. The existing server-owned 180-second maximum and six-hour expiry are appended exactly once. Roles, UID binding, upload grant response and failure settlement are unchanged.

The [tus creation protocol](https://tus.io/protocols/resumable-upload#creation) requires unique metadata keys and base64 values, allowing empty values. [Cloudflare direct creator uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/) places upload constraints in the initial Upload-Metadata header. This change does not introduce a new privacy policy or trust client uploadPolicy as a server constraint.

Verification extends the actual route fixture to inspect outbound metadata and prove no intent/provider operation on rejection. Actual HTTP/PostgreSQL rehearsal checks both companies against reserved keys, duplicate keys and malformed values with unchanged asset rows. Its explicit no-network provider checks exactly one duration/expiry and preserved descriptive values; no grant is followed. Existing admission races and provider UID binding tests remain.

No schema, migrations, credentials, hosted provider transfer or production deployment. This is synthetic qualification; Phase 1 remains open and production ON HOLD.
