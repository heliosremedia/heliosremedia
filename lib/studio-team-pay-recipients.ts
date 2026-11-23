import { createHmac, timingSafeEqual } from "node:crypto";

export const RECIPIENTS_PATH = "/api/internal/team-pay-recipients";
export const RECIPIENTS_ACTION_BODY = '{"action":"team-pay-admin-recipients"}';
export type RosterEntry = { id: string; role: string; email: string };
const BOUNDS = 256;
const responseHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
const reply = (status: number, contents: unknown) => Response.json(contents, {status, headers:responseHeaders});
const validID=(v:unknown):v is string=>typeof v==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(v);
export function designatedPayrollRole(id:string,role:string,ownerId:string|undefined,adminIds:string|undefined) {
  if (!validID(ownerId)) return false;
  if (role==="OWNER") return id===ownerId;
  if (!adminIds || role!=="ADMIN") return false;
  try {
    const ids:unknown=JSON.parse(adminIds);
    return Array.isArray(ids)&&ids.length<=19&&ids.every(validID)&&ids.includes(id);
  } catch { return false; }
}
const canEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;

async function requestBody(request: Request) {
  if (!request.body || Number(request.headers.get("content-length")) > BOUNDS) return null;
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", {fatal: true});
  let count = 0, result = "";
  try {
    for (;;) {
      const {done,value} = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > BOUNDS) { await reader.cancel(); return null; }
      result += decoder.decode(value, {stream: true});
    }
    return result + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

export async function teamPayRecipients(request: Request, {
  secret = process.env.TEAM_PAY_BRIDGE_SECRET,
  workspaceId = process.env.TEAM_PAY_WORKSPACE_ID,
  ownerId = process.env.TEAM_PAY_OWNER_USER_ID,
  adminIds = process.env.TEAM_PAY_ADMIN_USER_IDS,
  clock = Date.now,
  fetchRoster,
}: { secret?: string; workspaceId?: string; ownerId?: string; adminIds?: string; clock?: () => number; fetchRoster: (workspaceId: string) => Promise<RosterEntry[]> }) {
  const reject = () => reply(403, { code: "forbidden" });
  if (request.method !== "POST" || new URL(request.url).pathname !== RECIPIENTS_PATH) return reject();
  if (!secret || secret.length < 43 || secret.length > 256 || !workspaceId || !/^[a-zA-Z0-9_-]{1,100}$/.test(workspaceId)) return reject();
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return reject();
  const ts = request.headers.get("x-helios-pay-ts"), signature = request.headers.get("x-helios-pay-signature");
  if (!ts || !/^\d{10}$/.test(ts) || !signature || !/^[0-9a-f]{64}$/.test(signature)) return reject();
  if (Math.abs(Math.floor(clock()/1000)-Number(ts)) > 45) return reject();
  try {
    const body = await requestBody(request);
    if (body !== RECIPIENTS_ACTION_BODY) return reject();
    const actual = createHmac("sha256",secret).update(RECIPIENTS_PATH+"\n"+ts+"\n"+body).digest();
    if (!timingSafeEqual(Buffer.from(signature,"hex"),actual)) return reject();
    const admins = (await fetchRoster(workspaceId)).filter(a=>designatedPayrollRole(a.id,a.role,ownerId,adminIds));
    if (!admins.length || admins.length > 20 || !admins.some(a=>a.role==="OWNER")) return reply(503,{code:"roster_unavailable"});
    const unique = new Set<string>();
    const result = admins.map(a=>{
      const email = a.email.trim().toLowerCase();
      if (!canEmail(email) || unique.has(email) || !/^[a-zA-Z0-9_-]{1,100}$/.test(a.id) || !["OWNER","ADMIN"].includes(a.role)) throw Error();
      unique.add(email);
      return {id:a.id,role:a.role,email};
    });
    return reply(200,{admins: result});
  } catch { return reply(503,{code:"roster_unavailable"}); }
}
