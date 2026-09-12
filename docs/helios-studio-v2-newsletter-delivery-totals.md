# Newsletter recorded delivery totals

Status: draft after #277. No production data, provider configuration or delivery state changed during implementation.

The review response now includes both stored campaign totals and counts derived from its company-owned recipient records. SENT, FAILED, PENDING and SKIPPED remain separate categories. These are database record counts, not proof of inbox delivery or authorization to resend.

An explicitly confirmed administrator action can reconcile recipientCount, sentCount and failedCount. It rechecks access, locks the reviewed company/edition version, locks the campaign and recipient rows, and rejects claimed jobs, uncertain attempts, conflicting receipts, invalid evidence or outstanding missing-acceptance repairs. A conditional campaign update compares its captured version and previous totals. The same transaction writes the mandatory before/after audit. Matching totals are a no-op.

Edition status, campaign delivery status, send timestamps, recipients, consent, event history, attempt receipts and scheduled jobs are unchanged. The response continues to deny automatic retry authorization. Historical records may be counted as recorded without claiming new evidence of acceptance. Newsletter analytics' separate event-based metrics are not rewritten by this action.

Verification: 603 automated tests passed, zero failed; non-incremental TypeScript, scoped ESLint and diff checks passed. Prisma generation succeeded after restoring the development checkout. Tests execute the count classifier, reconciliation service and POST handler with fake database dependencies, covering role denial, version conflicts, claimed work, uncertainty, idempotency, conditional writes and mandatory audit errors. They do not prove hosted locking or rollback.

Hosted concurrent-worker/webhook tests, browser controls, lease recovery, provider reconciliation, historical record quality and deployment/rollback rehearsal remain gates. No job resumes or emails are sent by reconciliation.
