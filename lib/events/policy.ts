/** Durable send policy shared with the worker; no provider or database side effects. */
export function replayDecision(input:{firstAttemptAt:Date|null;attempts:number},now=Date.now()) {
  return (input.firstAttemptAt && now - +input.firstAttemptAt > 20*60*60_000) || input.attempts >= 5 ? "UNCERTAIN" : "ATTEMPT";
}
export function leaseClaimable(status:string,claimedAt:Date|null,now=Date.now()) {
  return status === "PENDING" || (status === "SENDING" && !!claimedAt && +claimedAt < now-5*60_000);
}
export function dispatchOpen(input:{eventStatus:string;deliveryStatus:string;startsAt:Date;scheduledAt:Date},now=Date.now()) {
  return input.eventStatus === "SCHEDULED" && input.deliveryStatus === "SCHEDULED" && +input.startsAt > now && +input.scheduledAt <= now;
}
