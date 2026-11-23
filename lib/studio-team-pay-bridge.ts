import { createHmac } from "node:crypto";

export const UPLOADER_PAY_BRIDGE = "https://helios-upload-portal.vercel.app/team-portal/internal/v1";

export type Actor = { userId: string; role: string; email: string };
export type PayKind = "basic" | "pro" | "luxe" | "photos_only" | "video_only" | "drone_only" | "zillow_3d" | "real_twilight" | "miscellaneous";
export type PayLine = { date: string; label: string; address?: string; cents: number | null; kind: PayKind; serviceRef: string; reason?: string };
type WorkTarget = { memberId: string; weekStart: string };
export type WorkRequest =
  | { action: "list"; weekStart: string }
  | ({ action: "get" | "sources" } & WorkTarget)
  | ({ action: "save"; expectedRevision: number; lines: PayLine[]; ready: boolean; noWork: boolean; reconciled: boolean } & WorkTarget)
  | ({ action: "review"; expectedRevision: number; decision: "approve" } & WorkTarget);
export type Week = WorkTarget & { revision: number; status: "draft" | "submitted" | "approved"; ready: boolean; lines: PayLine[]; noWork?: boolean; correction?: string | null; submittedAt?: string | null };
export type ReviewQueue = { enrolled: Array<{ id: string; name: string }>; weeks: Week[] };
export type SourceVisit = { date: string; address: string; timeLabel: string; refs: string[] };
export type PaySource = { state: "ready" | "unavailable"; visits: SourceVisit[] };
export type WorkResponse = ReviewQueue | { week: Week | null } | { source: PaySource };
export type Bridge = (actor: Actor, request: WorkRequest) => Promise<WorkResponse>;

export class TeamPayBridgeError extends Error {
  readonly status: number;
  constructor(status: number) {
    super("The Team Pay service did not confirm the request.");
    this.status = status;
  }
}

export const canReadPay = (actor: Actor | null): actor is Actor =>
  !!actor && ["OWNER", "ADMIN"].includes(actor.role) && /^[a-zA-Z0-9_-]{1,100}$/.test(actor.userId)
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(actor.email) && actor.email.length <= 254;

export function createStudioPayBridge({
  secret = process.env.TEAM_PAY_BRIDGE_SECRET,
  fetcher = fetch,
  env = process.env,
  clock = Date.now,
}: { secret?: string; fetcher?: typeof fetch; env?: NodeJS.ProcessEnv; clock?: () => number } = {}): Bridge {
  return async (actor, request) => {
    if (!canReadPay(actor) || ((request.action === "save" || request.action === "review") && actor.role !== "OWNER")) {
      throw new TeamPayBridgeError(403);
    }
    if (!secret || secret.length < 43 || secret.length > 256) throw new TeamPayBridgeError(503);
    let url = UPLOADER_PAY_BRIDGE;
    if (env.VERCEL_ENV === "preview") {
      const target = env.TEAM_PAY_UPLOADER_PREVIEW_ORIGIN;
      if (!target || !/^https:\/\/helios-upload-portal-[a-z0-9-]+-helios-real-estate-media\.vercel\.app$/.test(target)) throw new TeamPayBridgeError(503);
      url = target + "/team-portal/internal/v1";
    }
    const body = JSON.stringify({ ...request, actorId: actor.userId, actorRole: actor.role, email: actor.email.trim().toLowerCase() });
    const ts = String(Math.floor(clock() / 1_000));
    const signature = createHmac("sha256", secret).update(ts + "\n" + body).digest("hex");
    let response;
    try {
      response = await fetcher(url, {
        method: "POST", redirect: "error", cache: "no-store", credentials: "omit",
        headers: { accept: "application/json", "content-type": "application/json", "x-helios-pay-ts": ts, "x-helios-pay-signature": signature },
        body, signal: AbortSignal.timeout(32_000),
      });
    } catch { throw new TeamPayBridgeError(503); }
    if (!response.ok) throw new TeamPayBridgeError([400, 403, 404, 409, 422].includes(response.status) ? response.status : 503);
    try {
      const value = await response.json();
      if (!value || typeof value !== "object") throw Error();
      if (request.action === "list") {
        if (!Array.isArray(value.enrolled) || !Array.isArray(value.weeks) || value.enrolled.length > 20 || value.weeks.length > 20) throw Error();
        return { enrolled: value.enrolled, weeks: value.weeks };
      }
      if (request.action === "sources") {
        const source = value.source;
        if (!source || !["ready", "unavailable"].includes(source.state) || !Array.isArray(source.visits) || source.visits.length > 100) throw Error();
        if (source.state === "unavailable") return { source: { state: "unavailable", visits: [] } };
        const lastDay = new Date(Date.parse(request.weekStart + "T00:00:00Z") + 6*864e5).toISOString().slice(0,10);
        const text = (part: unknown, max: number) => typeof part === "string" && part.length <= max && !/[\u0000-\u001f\u007f]/.test(part);
        const visits = (source.visits as SourceVisit[]).map(row => {
          const validDate = row && typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
            row.date >= request.weekStart && row.date <= lastDay && new Date(row.date + "T00:00:00Z").toISOString().slice(0,10) === row.date;
          if (!validDate || !text(row.address,250) || !text(row.timeLabel,70) || !Array.isArray(row.refs) || row.refs.length > 120 ||
            row.refs.some(ref => typeof ref !== "string" || !/^[1-9]\d{0,15}:[1-9]\d{0,15}$/.test(ref))) throw Error();
          return { date:row.date, address:row.address, timeLabel:row.timeLabel, refs:row.refs };
        });
        return { source: { state: "ready", visits } };
      }
      if (value.week === null && request.action === "get") return { week: null };
      if (value.week?.memberId !== request.memberId || value.week?.weekStart !== request.weekStart || !Number.isSafeInteger(value.week?.revision)) throw Error();
      if (!Array.isArray(value.week.lines) || !["draft", "submitted", "approved"].includes(value.week.status)) throw Error();
      if (request.action === "review" && (value.week.status !== "approved" || value.week.revision !== request.expectedRevision)) throw Error();
      if (request.action === "save" && (value.week.status !== "draft" || value.week.revision !== request.expectedRevision + 1 || value.week.ready !== request.ready)) throw Error();
      return { week: value.week };
    } catch { throw new TeamPayBridgeError(503); }
  };
}
