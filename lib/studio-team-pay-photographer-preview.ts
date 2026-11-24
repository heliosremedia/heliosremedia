import {canReadPay, TeamPayBridgeError, type Actor, type Bridge} from "./studio-team-pay-bridge.ts";
import {appearanceCsp} from "./team-pay-appearance.ts";
import {renderStudioPayPage} from "./studio-team-pay-review.ts";

const PATH="/admin/team-pay/photographer-preview";
const RETURN="/admin/team-pay";
const safeHeaders={
  "Cache-Control":"private, no-store",
  "Vary":"Cookie",
  "Referrer-Policy":"no-referrer",
  "X-Content-Type-Options":"nosniff",
  "X-Robots-Tag":"noindex, nofollow",
  "X-Frame-Options":"DENY",
  "Content-Security-Policy":`default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self'; script-src ${appearanceCsp}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
};
const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]??""));
function page(body:string,status=200){
  const outer=renderStudioPayPage("Photographer View",body,status);
  return new Response(outer.body,{status,headers:{...safeHeaders,"Content-Type":"text/html; charset=utf-8"}});
}
const copy=(message:string,status:number)=>page(`<section class="card"><p>${esc(message)}</p><p><a href="${RETURN}">Back to Pay Review</a></p></section>`,status);
function isMonday(value:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d=new Date(value+"T00:00:00Z");
  return d.getUTCDay()===1 && d.toISOString().slice(0,10)===value;
}
type Audit = (input:{actor:Actor;memberId:string;section:"week"|"pay";weekStart:string|null})=>Promise<void>;

export async function handleStudioPhotographerPreview(request:Request, {
  readActor,bridge,audit,
}: {readActor:()=>Promise<Actor|null>;bridge:Bridge;audit:Audit}) {
  if (!["GET","HEAD"].includes(request.method))
    return new Response(null,{status:405,headers:{...safeHeaders,Allow:"GET, HEAD"}});
  const {searchParams:p,pathname}=new URL(request.url);
  if (pathname!==PATH) return new Response(null,{status:404,headers:safeHeaders});
  if (["cross-site","same-site"].includes(request.headers.get("sec-fetch-site")??"")) return new Response(null,{status:403,headers:safeHeaders});
  const member=p.get("memberId"), rawSection=p.get("section"), requestedWeek=p.get("week");
  const section=rawSection??"week";
  const hasMember=member!==null;
  const valid=Array.from(p.keys()).every(k=>["memberId","section","week"].includes(k)&&p.getAll(k).length===1) &&
    (hasMember ? /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(member) && ["week","pay"].includes(section) : rawSection===null && requestedWeek===null) &&
    (requestedWeek===null || (section==="pay" && isMonday(requestedWeek)));
  try {
    const actor=await readActor();
    if (!actor) {
      const safeNext=valid && hasMember ? PATH+"?"+new URLSearchParams({memberId:member,section,...(requestedWeek?{week:requestedWeek}:{})}) : PATH;
      return new Response(null,{status:303,headers:{...safeHeaders,Location:"/login?"+new URLSearchParams({next:safeNext})}});
    }
    if (!canReadPay(actor) || actor.role!=="OWNER") return request.method==="HEAD"?new Response(null,{status:403,headers:safeHeaders}):copy("Only the designated owner can open this view.",403);
    if (request.method==="HEAD" || /\bprefetch\b/i.test(request.headers.get("sec-purpose")??request.headers.get("purpose")??"")) return new Response(null,{status:204,headers:safeHeaders});
    if (!valid) return copy("Choose one photographer and a valid view.",400);
    if (member===null) {
      const result=await bridge(actor,{action:"photographer-preview-members"});
      if (!("photographers" in result)) throw Error();
      const rows=result.photographers.map(item=>`<li><div class="row-title"><a href="${PATH}?${esc(new URLSearchParams({memberId:item.id,section:"week"}).toString())}">${esc(item.name)}</a></div></li>`).join("");
      return page(`<section class="card"><h2>Choose a photographer</h2><p>See their schedule and My Pay without changing accounts or taking actions for them.</p>${rows?`<ul class="rows">${rows}</ul>`:"<p>No active photographers are available to preview.</p>"}<p><a href="${RETURN}">Back to Pay Review</a></p></section>`);
    }
    const view=section==="pay"?"pay":"week";
    const result=await bridge(actor,{action:"photographer-preview",memberId:member,section:view,...(requestedWeek?{weekStart:requestedWeek}:{})});
    if (!("preview" in result) || result.preview.memberId!==member || result.preview.section!==view) throw Error();
    await audit({actor,memberId:member,section:view,weekStart:result.preview.weekStart});
    return new Response(result.preview.html,{status:200,headers:{...safeHeaders,"Content-Type":"text/html; charset=utf-8"}});
  } catch(error) {
    const status=error instanceof TeamPayBridgeError?error.status:503;
    return status===404?copy("That photographer or pay week is not available to preview.",404):
      status===400?copy("Choose one photographer and a valid view.",400):copy("The photographer view could not be verified. No photographer data was shown.",status);
  }
}
