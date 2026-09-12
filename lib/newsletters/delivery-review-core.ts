type Recipient = { id: string; status: string; providerMessageId: string | null; sentAt: Date | null; _count: { events: number; resendWebhookEvents: number } };
type Attempt = { revisionId: string; status: string; recipientIds: unknown; providerReceiptIds: unknown };

function identities(value: unknown): string[] | null {
  return Array.isArray(value) && value.length > 0 && value.every(item => typeof item === "string" && item.length > 0)
    && new Set(value).size === value.length ? value : null;
}

/** Observations only. Absence of attempt evidence never proves that an email was not sent. */
export function reviewNewsletterDelivery(input: { revisionId: string; recipients: Recipient[]; attempts: Attempt[] }) {
  const known = new Set(input.recipients.map(recipient => recipient.id));
  const evidence = new Map(input.recipients.map(recipient => [recipient.id, { accepted: new Set<string>(), uncertain: false, rejected: false }]));
  let invalidAttempts = 0;
  for (const attempt of input.attempts) {
    const ids = identities(attempt.recipientIds);
    const receipts = attempt.status === "ACCEPTED" ? identities(attempt.providerReceiptIds) : null;
    if (attempt.revisionId !== input.revisionId || !ids || ids.some(id => !known.has(id))
      || !["PREPARED", "UNCERTAIN", "ACCEPTED", "REJECTED"].includes(attempt.status)
      || (attempt.status === "ACCEPTED" && (!receipts || receipts.length !== ids.length))) {
      invalidAttempts++; continue;
    }
    ids.forEach((id, index) => {
      const item = evidence.get(id)!;
      if (attempt.status === "ACCEPTED") item.accepted.add(receipts![index]);
      else if (attempt.status === "REJECTED") item.rejected = true;
      else item.uncertain = true;
    });
  }
  const recipients = input.recipients.map(recipient => {
    const item = evidence.get(recipient.id)!;
    const receipt = [...item.accepted][0];
    const conflict = item.accepted.size > 1 || (receipt && recipient.providerMessageId && receipt !== recipient.providerMessageId);
    const observation = invalidAttempts ? "INVALID_EVIDENCE" : conflict ? "RECEIPT_CONFLICT"
      : item.uncertain ? "UNCERTAIN" : receipt ? "ACCEPTED_EVIDENCE"
        : recipient.providerMessageId || recipient.status === "SENT" ? "HISTORICAL_SEND_RECORD"
          : item.rejected ? "REJECTED_ONLY" : "NO_RECORDED_ATTEMPT";
    return { recipientId: recipient.id, observation, recipientStatus: recipient.status,
      acceptedEvidence: item.accepted.size > 0,
      needsRecipientRecordRepair: Boolean(["PENDING", "FAILED"].includes(recipient.status) && !recipient.providerMessageId && !recipient.sentAt
        && recipient._count.events === 0 && recipient._count.resendWebhookEvents === 0 && receipt && !conflict && !item.uncertain && !invalidAttempts
        && (recipient.providerMessageId !== receipt || recipient.status !== "SENT")),
    };
  });
  const counts: Record<string, number> = {};
  for (const recipient of recipients) counts[recipient.observation] = (counts[recipient.observation] ?? 0) + 1;
  return { automaticRetryAllowed: false as const, invalidAttempts, counts, recipients };
}

/** Counts of recorded recipient states, not proof of inbox delivery. */
export function newsletterRecordedTotals(recipients: Array<{ status: string }>) {
  const totals = { recipientCount: recipients.length, sentCount: 0, failedCount: 0, pendingCount: 0, skippedCount: 0 };
  for (const recipient of recipients) {
    if (recipient.status === "SENT") totals.sentCount++;
    else if (recipient.status === "FAILED") totals.failedCount++;
    else if (recipient.status === "PENDING") totals.pendingCount++;
    else if (recipient.status === "SKIPPED") totals.skippedCount++;
    else throw new Error("NEWSLETTER_DELIVERY_RECORDS_INVALID");
  }
  return totals;
}
