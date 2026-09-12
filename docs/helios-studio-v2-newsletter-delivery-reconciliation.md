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

## Closing a fully accepted interruption

The administrator delivery-review POST now accepts `FINALIZE_ACCEPTED_DELIVERY` with the reviewed edition row version. It permits closure only for an owned SENDING edition whose approved revision matches the delivery, with every recipient already SENT and backed by matching unique durable ACCEPTED receipts and valid recorded timestamps. Empty, historical-only, skipped, incomplete, conflicting or uncertain evidence remains held. Recipient repair is a separate prior action.

Fresh administrator authorization, scoped edition locking, campaign/recipient/job locks and RepeatableRead protect the transaction. Active claims, missing lease expirations and claimed non-send work block closure. Expired SEND claims are completed with tokens cleared; pending SEND jobs are cancelled. Conditional edition and campaign writes advance row versions, reconcile accepted counts and preserve the latest recorded send time. Delivery completion and the mandatory audit commit together. No provider is invoked and nothing becomes retryable.

Executable classifier, service and route tests cover evidence rejection, ownership/version predicates, lease predicates, stale callback fencing fields, conditional-write failure, audit failure and session-only request authority. Mock transactions do not establish hosted rollback or scheduler/webhook concurrency. The capability is API-only pending the Studio review interface. Provider reconciliation of unknown acceptance remains a separate gate.

## Studio review controls

The edition page now includes an on-demand Delivery review panel. It shows aggregate evidence categories and stored versus recorded totals without exposing recipient emails or provider receipts. Each reconciliation action opens the existing accessible dialog and requires an explicit checkbox confirmation. The request sends the reviewed version and action only; every server guard still applies. No request is automatically retried. A failed operation or refresh clears the snapshot so the operator must load new evidence before another action.

After successful reconciliation, the panel refreshes its evidence and asks the operator to reload the edition for current editor status and analytics. This preserves any unsaved editor work. Browser focus, keyboard, mobile layout and authenticated workflow verification remain outstanding. The interface does not enable unknown-acceptance retry or provider lookup.

## Claim containment before execution

The scheduler now excludes SEND jobs whose edition is held in SENDING or a non-deliverable state, whose approval reference is absent, whose due date differs from the stored edition schedule, or whose due date is still in the future. PREPARED and UNCERTAIN attempt evidence blocks claiming even if the edition state was changed. Excluded rows retain their existing status, token and attempt count for review. The existing delivery service remains responsible for fresh company authorization, current approval validation, recipient eligibility and provider execution.

This preserves the existing eligible SCHEDULED, SEND_FAILED and PARTIALLY_SENT paths without authorizing additional retries. Generation and notification claim behavior is unchanged. It depends on the delivery-attempt table migration already present in the draft stack. Do not deploy the scheduler before that migration is verified. Real scheduler SQL is exercised against isolated PGlite fixtures, including two companies, expired claims, held attempts, stale dates and repeated claiming. This does not establish hosted lock ordering or full lease recovery. Heartbeats, queue fairness, generation recovery and operational visibility remain Phase 2 work.
