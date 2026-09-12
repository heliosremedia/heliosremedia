# Newsletter recipient refresh and uncertain delivery containment

Status: draft implementation after #273. No production deployment or real-recipient test.

## Protected workflow reason

Recipient consent, suppression and company membership can change during a multi-batch send. A single eligibility read cannot protect later batches. Separately, marking a batch FAILED after the provider accepted it but database persistence failed can allow an unsafe retry with a changed payload or idempotency key.

## Behavior

Each batch refreshes the existing company-scoped eligibility resolver before creating preference tokens or invoking the provider. Removed recipients are marked SKIPPED with campaign and pending/failed-state predicates. Empty batches do not invoke the provider. Original recipient identities and approved selection remain authoritative; newly eligible recipients are not added to the captured campaign.

Successful provider responses must contain an identifier for every recipient. A success followed by database failure, incomplete response, or uncertain provider error stops execution with NEWSLETTER_DELIVERY_RECONCILIATION_REQUIRED. The edition remains SENDING, which the exclusive-claim guard rejects on re-entry. Only the existing adapter's explicit preflight configuration failures (missing provider configuration or invalid sender, with no provider response) retain the retryable failure path. Other provider errors are conservatively held because preceding adapter attempts may have uncertain outcomes.

The API explains that reconciliation is needed and returns a conflict. Claim/busy errors also receive bounded conflict messages. Provider adapters, settings, tokens, payload construction and idempotency-key format are unchanged. Existing consent/suppression rules are reused.

## Verification and limits

Executable delivery tests use fake providers to cover eligibility removed before the first batch and between batches, zero token/provider effects for excluded recipients, successful receipt followed by persistence failure, incomplete receipts, uncertain network errors and retryable configuration failures. The test harness covers actual orchestration with mocked transactions, not hosted database locking or provider acceptance.

This is containment, not automatic recovery. Durable per-batch attempts, immutable payload receipts, provider reconciliation, lease recovery, historical delivery reconciliation, hosted concurrency and actual browser/test-send QA remain release gates. Never reset a held SENDING edition to retryable merely because a lease expired. Consent can still change between the final eligibility read and provider call; this interval and provider idempotency retention require explicit operational validation. All-recipient exclusion retains the existing no-send status behavior, which still needs workflow reconciliation.
