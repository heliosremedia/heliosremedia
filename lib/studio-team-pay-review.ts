import { canReadPay, parsePayPreflightChecks, TeamPayBridgeError, type Actor, type Bridge, type PayKind, type PayLine, type ReviewQueue, type Week, type PaySource, type PayPreflightChecks } from "./studio-team-pay-bridge.ts";

const PATH = "/admin/team-pay";
const PREFLIGHT_PATH = PATH + "/preflight";
export const STUDIO_ORIGIN = "https://www.heliosrealestatemedia.com";
const bounds = 96_000;
const MAX_ROWS = 40;
const headers = {
  "Cache-Control": "private, no-store",
  "Vary": "Cookie",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

const kinds: Record<PayKind, string> = { basic: "Base", pro: "Pro", luxe: "Luxe", photos_only: "Photos only", video_only: "Video only", drone_only: "Drone only", zillow_3d: "Zillow 3D", real_twilight: "Real twilight", miscellaneous: "Miscellaneous" };
const str = (x: unknown) => typeof x === "string" ? x : "";
const esc = (x: unknown) => String(x ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? "");
const memberId = (x: unknown) => /^[a-zA-Z0-9_-]{1,100}$/.test(str(x));
const revisionId = (x: unknown) => /^\d{1,10}$/.test(str(x)) && Number(x) <= 2_147_483_647;
const day = (x: unknown): x is string => {
  const value = str(x);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
};
const addDays = (date: string, n: number) => new Date(Date.parse(date + "T00:00:00Z") + n*864e5).toISOString().slice(0,10);
const monday = (x: unknown): x is string => day(x) && new Date(x + "T00:00:00Z").getUTCDay() === 1;
function currentMonday(now: Date) {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Denver", year: "numeric", month: "2-digit", day: "2-digit" });
  const p = Object.fromEntries(local.formatToParts(now).map(part => [part.type, part.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  return addDays(date, -((new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7));
}
function link(week: string, id?: string, revision?: number) {
  const p = new URLSearchParams({week});
  if (id) p.set("memberId", id);
  if (revision !== undefined) p.set("revision", String(revision));
  return PATH + "?" + p.toString();
}
function redirect(location: string) { return new Response(null, { status: 303, headers: {...headers, Location: location} }); }
function page(title: string, content: string, status = 200, head = false) {
  return new Response(head ? null : `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | Helios Studio</title><style>
*{box-sizing:border-box}body{margin:0;background:#141414;color:#f6f3ee;font:16px/1.5 system-ui,sans-serif}main{width:min(1080px,100%);margin:auto;padding:clamp(18px,4vw,48px)}a{color:#f4bb93}a:hover{text-decoration:none}a:focus-visible,input:focus-visible,select:focus-visible,button:focus-visible,summary:focus-visible{outline:2px solid #d96b2b;outline-offset:3px}h1{font-size:clamp(1.55rem,3vw,2.4rem);line-height:1.15;margin:.55rem 0}h2{font-size:1.2rem}.eyebrow{font-size:.77rem;letter-spacing:.14em;text-transform:uppercase;color:#d7b29b;font-weight:650}.card{background:#1d1d1d;border:1px solid #ffffff20;border-radius:14px;padding:clamp(14px,2vw,24px);margin:20px 0}.muted{color:#c6c1bb}.actions{display:flex;gap:12px;flex-wrap:wrap}.actions a,button{background:#ffffff0d;border:1px solid #ffffff29;color:#f6f3ee;text-decoration:none;padding:9px 12px;border-radius:8px;font:inherit;min-height:44px;cursor:pointer}.actions a:hover,button:hover{background:#ffffff17}button.primary{border-color:#d96b2b}ul{padding-left:20px}.rows{list-style:none;padding:0}.rows>li{padding:.9rem 0;border-bottom:1px solid #ffffff20}.rows>li:last-child{border-bottom:0}.row-title{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.badge{background:#ffffff12;padding:4px 8px;border-radius:999px;font-size:.85rem}.notice{border-left:3px solid #d96b2b;padding:10px 12px;background:#ffffff08}.correction{white-space:pre-wrap;overflow-wrap:anywhere}.line-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:10px;margin-top:12px}label{display:block}input:not([type=checkbox]),select{display:block;margin-top:3px;width:100%;font:inherit;color:#f6f3ee;background:#141414;border:1px solid #ffffff40;padding:7px;border-radius:5px}details{margin:10px 0;padding:9px 12px;border:1px solid #ffffff26;border-radius:8px}summary{cursor:pointer}.checks label{margin:12px 0}[aria-current]{font-weight:650}@media(max-width:520px){.row-title{display:block}.badge{display:inline-block;margin-top:5px}}</style><main><a href="/admin">Helios Studio</a><p class="eyebrow">Helios Team Portal</p><h1>${esc(title)}</h1>${content}</main></html>`, {
    status, headers: {...headers, "Content-Type": "text/html; charset=utf-8" },
  });
}

const validText = (x: string, size: number) => x.length <= size && !/[\u0000-\u001f\u007f]/.test(x);
const serviceRef = (s: string) => /^(?:[1-9]\d{0,15}:[1-9]\d{0,15}|manual:[A-Za-z0-9][A-Za-z0-9._/-]{0,94})$/.test(s);
function cents(value: string) {
  if (!value) return null;
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(value)) throw new TeamPayBridgeError(422);
  const [whole, decimal = ""] = value.split(".");
  return Number(whole)*100 + Number(decimal.padEnd(2,"0"));
}
const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 100);
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-US", {month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(value + "T00:00:00Z"));

async function formData(req: Request, maxBytes = bounds) {
  if (req.headers.get("content-type")?.split(";")[0].trim() !== "application/x-www-form-urlencoded" || Number(req.headers.get("content-length")) > maxBytes || !req.body) throw new TeamPayBridgeError(422);
  const rd = req.body.getReader();
  const decoder = new TextDecoder();
  let data = "", total = 0;
  try {
    for (;;) {
      const {value, done} = await rd.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await rd.cancel(); throw new TeamPayBridgeError(422); }
      data += decoder.decode(value, {stream: true});
    }
    data += decoder.decode();
  } finally { rd.releaseLock(); }
  const params = new URLSearchParams(data);
  const seen = new Set<string>();
  for (const key of params.keys()) {
    if (seen.has(key)) throw new TeamPayBridgeError(422);
    seen.add(key);
  }
  return params;
}

function parseLines(form: URLSearchParams, week: string) {
  const lines: PayLine[] = [];
  const seen = new Set<string>();
  const fields = ["date", "label", "address", "kind", "serviceRef", "amount", "reason"] as const;
  for (const key of form.keys()) {
    const m = /^line_(0|[1-9][0-9]*)_(date|label|address|kind|serviceRef|amount|reason)$/.exec(key);
    if (key.startsWith("line_") && (!m || Number(m[1]) >= MAX_ROWS)) throw new TeamPayBridgeError(422);
  }
  for (let i = 0; i < MAX_ROWS; i++) {
    const l = Object.fromEntries(fields.map(f => [f, (form.get(`line_${i}_${f}`) ?? "").trim()])) as Record<(typeof fields)[number], string>;
    if (Object.values(l).every(x => !x)) continue;
    if (!day(l.date) || l.date < week || l.date > addDays(week, 6) || !l.label || !validText(l.label, 160) || !validText(l.address, 160) ||
      !Object.hasOwn(kinds, l.kind) || !serviceRef(l.serviceRef) || seen.has(l.serviceRef.toLowerCase()) || !validText(l.reason, 300)) throw new TeamPayBridgeError(422);
    const value = cents(l.amount);
    if (value !== null && !["basic", "pro"].includes(l.kind) && !l.reason) throw new TeamPayBridgeError(422);
    seen.add(l.serviceRef.toLowerCase());
    lines.push({date:l.date,label:l.label,...(l.address ? { address:l.address } : {}),kind:l.kind as PayKind,serviceRef:l.serviceRef,cents:value,...(l.reason ? {reason:l.reason} : {})});
  }
  return lines;
}

const statusLabel = (w: Week | null) => !w ? "Not prepared" : w.status === "approved" ? "Approved" : w.status === "submitted" ? "Awaiting owner approval" : w.correction ? "Correction requested" : w.ready ? "Ready for photographer" : "Admin draft";

function listView(queue: ReviewQueue, week: string) {
  const rows = queue.enrolled.filter(row => memberId(row?.id)).map(row => {
    const w = queue.weeks.find(w => w?.memberId === row.id && w.weekStart === week);
    return `<li><div class="row-title"><a href="${esc(link(week,row.id))}">${esc(row.name)}</a><span class="badge">${esc(statusLabel(w ?? null))}</span></div></li>`;
  }).join("");
  return `<section class="card"><h2>Photographer reviews</h2>${rows ? `<ul class="rows">${rows}</ul>` : '<p>No photographers are enrolled for this workflow.</p>'}</section>`;
}

function lineFields(l: PayLine | undefined, i: number) {
  const field = (key: string, title: string, max: number, value: string, extras = "") =>
    `<label>${esc(title)}<input name="line_${i}_${esc(key)}" maxlength="${max}" value="${esc(value)}" ${extras}></label>`;
  return `<details${l?.label ? " open" : ""}><summary>${esc(l?.label || `Pay line ${i+1}`)}</summary><div class="line-grid">${field("date","Service date",10,l?.date ?? "",'type="date"')}${field("label","Service",160,l?.label ?? "")}${field("address","Property address (optional)",160,l?.address ?? "")}<label>Category<select name="line_${i}_kind"><option value="">Choose a category</option>${Object.entries(kinds).map(([k,v])=>`<option value="${k}"${l?.kind===k?" selected":""}>${esc(v)}</option>`).join("")}</select></label>${field("serviceRef","Hub orderId:taskId or manual:reference",110,l?.serviceRef??"")}${field("amount","Pay in USD (blank = review)",8,l?.cents==null?"":(l.cents/100).toFixed(2),'inputmode="decimal"')}${field("reason","Reason for specialty or one-off pay",300,l?.reason??"")}</div></details>`;
}

function hidden(name: string, value: unknown) { return `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`; }

function sourceView(source: PaySource | null, destination: string) {
  const header = '<section class="card" id="assigned-visits"><h2>HDPhotoHub assignments</h2><p class="muted">These are scheduled assignments, not proof of attendance or pay. Verify that the photographer did the work before using a reference.</p>';
  if (!source) return header+`<p><a href="${esc(destination)}">Load assignments</a> before editing the weekly draft.</p></section>`;
  if (source.state === "unavailable") return header+`<p class="notice" role="status">Assignments are unavailable. This does not mean there was no work.</p><a href="${esc(destination)}">Retry assignments</a></section>`;
  if (!source.visits.length) return header+'<p>No matching scheduled assignments were returned. Check for reshoots or off-schedule work separately.</p></section>';
  return header+`<ul class="rows">${source.visits.map(visit=>{
    const refs = visit.refs.length ? visit.refs.map(ref=>`<code>${esc(ref)}</code>`).join(", ") : "No verified service references for this appointment.";
    return `<li><div class="row-title"><strong>${esc(visit.address || "Address unavailable")}</strong><span class="muted">${esc(dateLabel(visit.date))}${visit.timeLabel ? " · "+esc(visit.timeLabel) : ""}</span></div><div class="muted">${refs}</div></li>`;
  }).join("")}</ul></section>`;
}

function detailView(w: Week | null, who: string, week: string, canWrite: boolean, id: string, moreRows: boolean, noticeRevision?: number, notice = "", source: PaySource | null = null) {
  if (noticeRevision !== undefined && noticeRevision !== w?.revision) return `<section class="card"><h2>This revision is no longer current</h2><p>No approval action is available from this notice.</p><a href="${esc(link(week,id))}">Open the latest review</a></section>`;
  const lines = w?.lines ?? [];
  const total = lines.length && lines.every(l => Number.isSafeInteger(l.cents) && (l.cents ?? -1) >= 0) ? lines.reduce((a,l) => a + (l.cents ?? 0),0) : null;
  const fields = hidden("memberId",id) + hidden("weekStart",week) + hidden("expectedRevision",w?.revision ?? 0);
  let body = `<section class="card"><div class="row-title"><h2>${esc(who)}</h2><span class="badge">${esc(statusLabel(w))}</span></div>${w?.correction ? `<p class="notice correction"><strong>Photographer correction:</strong> ${esc(w.correction)}</p>` : ""}${lines.length ? `<ul class="rows">${lines.map(l=>`<li><div class="row-title"><strong>${esc(l.label)}</strong><span>${l.cents == null ? "Rate needs review" : esc(money(l.cents))}</span></div><span class="muted">${esc(l.date)} · ${esc(kinds[l.kind] ?? l.kind)} · ${esc(l.serviceRef)}${l.address ? ` · ${esc(l.address)}` : ""}</span>${l.reason ? `<div class="muted">Rate note: ${esc(l.reason)}</div>` : ""}</li>`).join("")}</ul>` : `<p>${w?.noWork ? "No eligible work was confirmed for this week." : "No pay lines have been prepared."}</p>`}<p><strong>${total !== null ? `Total: ${esc(money(total))}` : w?.noWork ? "Total: $0.00" : "Total pending review"}</strong></p>${notice ? `<p class="notice" role="status">${esc(notice)}</p>` : ""}`;
  if (canWrite && w?.status === "submitted") {
    body += `<form method="post" action="${PATH}">${fields}${hidden("action","review")}<p><label><input type="checkbox" name="confirmApproval" value="yes" required> I checked this exact signed revision. Approval does not issue payment.</label></p><button class="primary">Approve signed revision</button></form>`;
  }
  const baseLink = link(week,id,noticeRevision) + (moreRows ? "&expanded=1" : "");
  body += `</section>` + sourceView(source,baseLink+"&source=1#assigned-visits");
  if (canWrite && (!w || w.status === "draft")) {
    const count = moreRows ? MAX_ROWS : Math.min(MAX_ROWS, Math.max(6, lines.length + 2));
    body += `<section class="card"><h2>${w ? "Edit weekly draft" : "Prepare a weekly draft"}</h2><p class="muted">Reconcile pay lines to the final HDPhotoHub assignments and verify that the photographer did the work. Confirmed rates fill when available. Other blank rates stay under review. Do not confuse an empty schedule with confirmed no work.</p>${!moreRows ? `<p><a href="${esc(link(week,id)+"&expanded=1"+(source ? "&source=1" : ""))}">Show more rows before editing</a></p>` : ""}<form method="post" action="${PATH}">${fields}${hidden("action","save")}${Array.from({length:count},(_,i)=>lineFields(lines[i],i)).join("")}<div class="checks"><label><input type="checkbox" name="noWork" value="yes"${w?.noWork?" checked":""}> Explicitly confirm no eligible work. Leave every pay line blank.</label><label><input type="checkbox" name="reconciled" value="yes"> I reconciled this week against final assignments and confirmed the work and rates.</label><label><input type="checkbox" name="ready" value="yes"> Release for photographer sign-off after this week closes.</label></div><button class="primary">Save weekly draft</button></form></section>`;
  }
  return body;
}

function statusView(status: number, week: string, id?: string, ownerPreflight = "") {
  const [title, message] = status === 409 ? ["This review changed", "Nothing new was confirmed. Reopen the current revision before making changes."] :
    status === 422 || status === 400 ? ["Review the form", "Check that each line is complete and has a unique source reference. To release a week, confirm the work and every rate, or explicitly confirm no eligible work."] :
    status === 404 ? ["Review not found", "This photographer or week is not available."] :
    status === 403 ? ["Access denied", "This action requires authorized Helios Studio access."] :
    ["Pay Review unavailable", "The Team Pay service did not confirm the request. Check the current revision before trying again."];
  return page(title, `<section class="card"><p>${esc(message)}</p><a href="${esc(link(week,id))}">Back to Pay Review</a>${ownerPreflight}</section>`, status);
}

export async function handleStudioPay(request: Request, {
  readActor, bridge, clock = () => new Date(), writesEnabled = false, activationWeek,
}: {readActor: () => Promise<Actor|null>; bridge: Bridge; clock?: () => Date; writesEnabled?: boolean; activationWeek?: string}) {
  const url = new URL(request.url);
  const current = currentMonday(clock());
  const prior = addDays(current,-7);
  const activation = monday(activationWeek) ? activationWeek : null;
  const defaultWeek = activation && prior < activation ? current : prior;
  const rawWeek = url.searchParams.get("week");
  const week = monday(rawWeek) && rawWeek <= current && (!activation || rawWeek >= activation) ? rawWeek : defaultWeek;
  const id = url.searchParams.get("memberId");
  const idOk = memberId(id) ? id ?? undefined : undefined;
  const revision = url.searchParams.get("revision");
  const showSources = url.searchParams.get("source") === "1";
  const todayPath = link(week,idOk, idOk && revisionId(revision) ? Number(revision) : undefined) + (idOk && showSources ? "&source=1" : "");
  let preflight = "";
  try {
    const actor = await readActor();
    if (!actor) return request.method === "GET" || request.method === "HEAD" ? redirect("/login?"+new URLSearchParams({next:todayPath})) : statusView(403,week);
    if (!canReadPay(actor)) return statusView(403,week);
    const canWrite = writesEnabled === true && actor.role === "OWNER";
    const shadow = writesEnabled === true ? "" : '<p class="notice" role="status">Read-only rollout check. Saving, approval and release actions are disabled.</p>';
    preflight = actor.role === "OWNER" ? `<p><a href="${PREFLIGHT_PATH}">Check rollout readiness</a></p>` : "";
    if (request.method === "HEAD") return page("Team Pay Review","",200,true);
    if (request.method === "POST") {
      if (actor.role !== "OWNER" || request.headers.get("origin") !== STUDIO_ORIGIN) return statusView(403,week);
      if (!canWrite) return page("Team Pay Review is read-only",shadow+preflight,503);
      const form = await formData(request);
      const target = form.get("memberId");
      const start = form.get("weekStart");
      const expected = form.get("expectedRevision");
      if (!target || !memberId(target) || !monday(start) || start > current || (activation && start < activation) || !revisionId(expected)) return statusView(422,week);
      const requestTarget = { memberId:target, weekStart:start, expectedRevision:Number(expected) };
      const action = form.get("action");
      try {
        if (action === "review") {
          if (form.get("confirmApproval") !== "yes" || start >= current || requestTarget.expectedRevision <= 0) return statusView(422,start,target);
          await bridge(actor,{action:"review",...requestTarget,decision:"approve"});
          return redirect(link(start,target)+"&saved=approved");
        }
        if (action !== "save") return statusView(422,start,target);
        const lines = parseLines(form,start);
        const ready = form.get("ready") === "yes", noWork = form.get("noWork") === "yes", reconciled = form.get("reconciled") === "yes";
        if ((noWork && (lines.length > 0 || !reconciled)) || (ready && (!reconciled || (!noWork && !lines.length) || lines.some(l=>l.cents===null && !["basic", "pro"].includes(l.kind))))) return statusView(422,start,target);
        await bridge(actor,{action:"save",...requestTarget,lines,ready,noWork,reconciled});
        return redirect(link(start,target)+"&saved=draft");
      } catch (error) { return statusView(error instanceof TeamPayBridgeError ? error.status : 503,start,target); }
    }
    if (request.method !== "GET") return new Response(null,{status:405, headers:{...headers,Allow:"GET, HEAD, POST"}});
    if ((rawWeek !== null && rawWeek !== week) || (id !== null && !idOk) || (revision !== null && (!idOk || !revisionId(revision) || Number(revision) === 0))) return statusView(422,week,idOk);
    if (activation && activation > current) return page("Team Pay Review",`<section class="card"><p>My Pay opens the week of ${esc(dateLabel(activation))}. This view is read-only until then.</p></section>`+preflight);
    const queue = await bridge(actor,{action:"list",weekStart:week});
    if (!("enrolled" in queue)) return statusView(503,week,idOk,preflight);
    const nav = shadow+preflight+`<p class="muted">Week of ${esc(dateLabel(week))} to ${esc(dateLabel(addDays(week,6)))} · Mountain Time</p><nav class="actions" aria-label="Pay review weeks">${!activation || week > activation ? `<a href="${esc(link(addDays(week,-7)))}">Earlier week</a>` : ""}${week < current ? `<a href="${esc(link(addDays(week,7)))}">Later week</a>` : ""}${idOk ? `<a href="${esc(link(week))}">All photographers</a>` : ""}</nav>`;
    if (!idOk) return page("Team Pay Review",nav+listView(queue,week));
    const owner = queue.enrolled.find(m=>m?.id===idOk);
    if (!owner) return statusView(404,week);
    const detail = await bridge(actor,{action:"get",memberId:idOk,weekStart:week});
    if (!("week" in detail)) return statusView(503,week,idOk);
    const w = detail.week;
    let source: PaySource | null = null;
    if (showSources && (revision === null || Number(revision) === w?.revision)) {
      source = {state:"unavailable",visits:[]};
      try {
        const result = await bridge(actor,{action:"sources",memberId:idOk,weekStart:week});
        if ("source" in result) source=result.source;
      } catch {
        // The saved draft and approval are still available without schedule data.
      }
    }
    const saved = url.searchParams.get("saved");
    const notice = saved==="approved" && w?.status==="approved" ? "This signed revision is approved. No payment was issued." : saved==="draft" && w?.status==="draft" ? "Draft saved. No payment was issued." : "";
    return page("Team Pay Review",nav+detailView(w,owner.name,week,canWrite,idOk,url.searchParams.get("expanded")==="1",revision===null ? undefined : Number(revision),notice,source));
  } catch (error) { return statusView(error instanceof TeamPayBridgeError ? error.status : 503,week,idOk,preflight); }
}

function preflightRows(c: PayPreflightChecks) {
  const result = (yes: boolean) => yes ? "Verified" : "Not verified";
  const count = (value: number | null) => value ?? "Unavailable";
  const match = c.sourceReady && c.benchmarkVisitCount === 6 && c.benchmarkTaskCount === 31;
  const countsConfirmed = c.enrolledCount !== null && c.expectedEnrolledCount !== null &&
    c.enrolledCount > 0 && c.enrolledCount === c.expectedEnrolledCount;
  const items = [
    ["Uploader configuration",result(c.configured)],
    ["Signed Studio and Uploader connection",result(c.bridgeReady)],
    ["Durable pay storage",result(c.storeReady)],
    ["Photographer mapping",`${result(countsConfirmed)} (${count(c.enrolledCount)} active / ${count(c.expectedEnrolledCount)} expected)`],
    ["HDPhotoHub V3 historical benchmark",c.sourceReady ? `${match ? "Matched" : "Mismatch"}: ${count(c.benchmarkVisitCount)} visits / ${count(c.benchmarkTaskCount)} tasks (expected 6 / 31)` : "Unavailable (not an empty week)"],
    ["Mail sender configuration",c.senderConfigured ? "Configured" : "Not configured"],
    ["Mail sender matches approved address",result(c.senderVerified)],
    ["Designated owner recipient",result(c.ownerRecipientReady)],
    ["Eligible Studio recipients",count(c.eligibleReviewerCount)],
    ["Pay writes",c.writesEnabled ? "On" : "Off"],
    ["Team Pay email dispatch",c.emailsEnabled ? "On" : "Off"],
  ];
  return `<ul class="rows">${items.map(([name,value])=>`<li class="row-title"><strong>${esc(name)}</strong><span>${esc(value)}</span></li>`).join("")}</ul>`;
}

export async function handleStudioPayPreflight(request: Request, {
  readActor,bridge,sinkCheckEnabled=false,
}: {readActor:()=>Promise<Actor|null>;bridge:Bridge;sinkCheckEnabled?:boolean}) {
  const title = "Team Pay rollout readiness";
  const url = new URL(request.url);
  if (url.pathname !== PREFLIGHT_PATH) return page("Not found","",404);
  if (!["GET","HEAD","POST"].includes(request.method)) return new Response(null,{status:405,headers:{...headers,Allow:"GET, HEAD, POST"}});
  if (url.search) return page(title,"<p>This check does not accept filters.</p>",400,request.method==="HEAD");
  const post = request.method === "POST";
  const canonical = url.origin === STUDIO_ORIGIN;
  const back = `<p><a href="${PREFLIGHT_PATH}">Back to rollout readiness</a></p>`;
  if (post && (!canonical || request.headers.get("origin") !== STUDIO_ORIGIN)) {
    return page("Access denied","<p>Launch the test from Helios Studio.</p>",403);
  }
  try {
    const actor = await readActor();
    if (!actor) return post ? page("Access denied",back,403) : redirect("/login?"+new URLSearchParams({next:PREFLIGHT_PATH}));
    if (!canReadPay(actor) || actor.role !== "OWNER") return page("Access denied","<p>Only the designated Studio owner can run this check.</p>",403,request.method==="HEAD");
    if (request.method === "HEAD") return page(title,"",200,true);
    if (post) {
      if (sinkCheckEnabled !== true) return page(title,"<p>The synthetic email test is off.</p>"+back,503);
      let form: URLSearchParams;
      try {
        form=await formData(request,64);
      } catch {
        return page(title,"<p>Confirm the synthetic email test in Studio.</p>"+back,422);
      }
      if ([...form].length !== 1 || form.get("confirmSink") !== "yes") {
        return page(title,"<p>Confirm the synthetic email test in Studio.</p>"+back,422);
      }
      const outcome = await bridge(actor,{action:"mail-sink-check"});
      if ("sinkAccepted" in outcome && outcome.sinkAccepted === true) {
        return page(title,'<p class="notice" role="status">Resend accepted the synthetic test request. No team or customer email was sent. Acceptance does not confirm real delivery.</p>'+back);
      }
      return page(title,'<p class="notice" role="status">Resend did not confirm the synthetic test request.</p>'+back,503);
    }
    const response = await bridge(actor,{action:"preflight"});
    const checks = "checks" in response ? parsePayPreflightChecks(response.checks) : null;
    if (!checks) throw new TeamPayBridgeError(503);
    const showSink = canonical && sinkCheckEnabled === true && checks.writesEnabled === false && checks.emailsEnabled === false;
    const sink = showSink ? `<section class="card"><h2>Synthetic email test</h2><p>This calls a fixed Resend test address. It includes no personnel or pay data and does not send email to staff, owners, or customers.</p><form method="post" action="${PREFLIGHT_PATH}"><p><label><input name="confirmSink" value="yes" type="checkbox" required> I want to run the synthetic email test.</label></p><button class="primary">Run synthetic test</button></form></section>` : "";
    return page(title,`<p><a href="${PATH}">Back to Pay Review</a></p><section class="card"><p>Loading this page reads status only. It does not change pay records or send mail.</p>${preflightRows(checks)}<p class="muted">The historical benchmark is November 16–22, 2026. A sender match does not confirm delivery.</p></section>`+sink);
  } catch {
    return post ? page(title,'<p class="notice" role="status">The Team Pay service did not confirm the synthetic test request.</p>'+back,503) :
      page(title,`<p class="notice" role="status">The Team Pay service did not verify rollout readiness. This is not an empty or completed check.</p><p><a href="${PATH}">Back to Pay Review</a></p>`,503,request.method==="HEAD");
  }
}
