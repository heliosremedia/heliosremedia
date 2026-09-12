"use client";

import { useEffect, useRef, useState } from "react";
import AccessibleDialog from "./AccessibleDialog";
import { deliveryReviewActions, requestDeliveryReview, type DeliveryReview, type DeliveryReviewAction } from "./delivery-review-client";

const observationLabels: Record<string, string> = {
  ACCEPTED_EVIDENCE: "Matching acceptance evidence", UNCERTAIN: "Uncertain acceptance",
  RECEIPT_CONFLICT: "Conflicting receipts", INVALID_EVIDENCE: "Invalid evidence",
  HISTORICAL_SEND_RECORD: "Historical records without attempt evidence", REJECTED_ONLY: "Recorded rejection only",
  NO_RECORDED_ATTEMPT: "No recorded attempt",
};

export default function DeliveryReviewPanel({ editionId }: { editionId: string }) {
  const [review, setReview] = useState<DeliveryReview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [action, setAction] = useState<DeliveryReviewAction | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function run(mutation?: DeliveryReviewAction) {
    if (pending.current || (mutation && (!review || !confirmed))) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true); setMessage(""); setAction(null); setConfirmed(false);
    let updated = false;
    try {
      if (mutation) {
        await requestDeliveryReview(editionId, { confirmation: mutation, expectedVersion: review!.rowVersion }, controller.signal);
        updated = true;
        if (controller.signal.aborted) return;
        setReview(null);
        setMessage("Delivery records updated. No email was sent. Reload the edition to refresh its status and performance.");
      }
      const latest = await requestDeliveryReview(editionId, undefined, controller.signal);
      if (!controller.signal.aborted) setReview(latest);
    } catch (error) {
      if (!controller.signal.aborted) {
        setReview(null);
        setMessage(updated ? "Records were updated, but the refreshed review could not be loaded. Load a new review before another action." : error instanceof Error ? error.message : "Refresh the delivery review before trying again.");
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (pending.current === controller) pending.current = null;
    }
  }

  const delivery = review?.delivery;
  const close = () => { if (!busy) { setAction(null); setConfirmed(false); } };
  return <section aria-labelledby="delivery-review-title" className="mt-7 space-y-5 rounded-2xl border border-white/10 bg-[#111] p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 id="delivery-review-title" className="text-2xl font-light text-white">Delivery review</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/60">Inspect interrupted deliveries and reconcile stored records. These actions send no email and never authorize a retry.</p></div>
      <button className="admin-btn-secondary" disabled={busy} onClick={() => void run()}>{busy ? "Checking delivery…" : review ? "Refresh review" : "Load delivery review"}</button>
    </div>
    <p role="status" aria-live="polite" className="text-sm text-white/75">{message}</p>
    {review && !delivery && <p className="text-sm text-white/60">No delivery has been recorded for this edition.</p>}
    {review && delivery && <>
      <p className="text-sm text-white/70">Recorded edition state: {review.editionStatus.replaceAll("_", " ").toLowerCase()}. Acceptance evidence does not prove inbox delivery.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm text-white/70">
        <caption className="mb-3 text-left font-medium text-white">Campaign totals</caption>
        <thead><tr><th scope="col" className="p-2">Record</th><th scope="col" className="p-2">Stored total</th><th scope="col" className="p-2">Recipient records</th></tr></thead>
        <tbody>{([['Recipients', 'recipientCount'], ['Sent', 'sentCount'], ['Failed', 'failedCount']] as const).map(([label, key]) => <tr key={key} className="border-t border-white/10"><th scope="row" className="p-2 font-normal">{label}</th><td className="p-2">{delivery.totals.stored[key]}</td><td className="p-2">{delivery.totals.recorded[key]}</td></tr>)}</tbody>
      </table></div>
      <p className="text-sm text-white/60">Pending: {delivery.totals.recorded.pendingCount}. Skipped: {delivery.totals.recorded.skippedCount}.</p>
      <ul className="space-y-2 text-sm text-white/70">{Object.entries(delivery.counts).map(([observation, count]) => <li key={observation}>{observationLabels[observation] ?? "Unrecognized evidence"}: {count}</li>)}</ul>
      <p className="text-sm text-white/60">Records eligible for acceptance repair: {delivery.recipients.filter(item => item.needsRecipientRecordRepair).length}. Active work, changed records or unresolved evidence can block reconciliation.</p>
      <div className="flex flex-wrap gap-3">{(Object.keys(deliveryReviewActions) as DeliveryReviewAction[]).map(key => <button key={key} className="admin-btn-secondary" disabled={busy} onClick={() => { setAction(key); setConfirmed(false); }}>{deliveryReviewActions[key].label}</button>)}</div>
    </>}
    <AccessibleDialog open={action !== null} onClose={close} labelledBy="delivery-confirm-title" size="max-w-lg">
      {action && <div className="space-y-5 p-6"><h3 id="delivery-confirm-title" className="text-xl text-white">{deliveryReviewActions[action].label}</h3>
        <p className="text-sm text-white/70">{deliveryReviewActions[action].detail} The server will recheck your access and the reviewed records.</p>
        <label className="flex items-start gap-3 text-sm text-white/80"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-1" />I reviewed the evidence and want to reconcile these records. No email will be sent.</label>
        <div className="flex flex-wrap gap-3"><button className="admin-btn-secondary" onClick={close}>Cancel</button><button className="admin-btn-primary" disabled={busy || !confirmed} onClick={() => void run(action)}>Confirm reconciliation</button></div>
      </div>}
    </AccessibleDialog>
  </section>;
}
