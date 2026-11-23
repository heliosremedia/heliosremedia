import {createHmac,timingSafeEqual} from "node:crypto";
import {currentPayWeek,payWeek,positiveId,readHubPayWeek} from "./team-pay-schedule-reader.ts";

export const STUDIO_TEAM_PAY_SCHEDULE_PATH="/api/internal/team-pay-schedule";
const targetPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"no-referrer"};
const deny=()=>Response.json({state:"forbidden"},{status:403,headers});
const safe=(status:number,body:unknown)=>Response.json(body,{status,headers});
async function requestText(request:Request){
 if(!request.body||Number(request.headers.get("content-length"))>512)return null;
 const reader=request.body.getReader(), decoder=new TextDecoder("utf-8",{fatal:true});let text="",size=0;
 try{
  for(;;){
   const {value,done}=await reader.read();if(done)break;
   size+=value.byteLength;if(size>512){await reader.cancel();return null;}
   text+=decoder.decode(value,{stream:true});
  }
  return text+decoder.decode();
 }finally{reader.releaseLock();}
}
function mappings(value:string|undefined){
 try{
  const input=JSON.parse(value||"{}");
  if(!input||Array.isArray(input)||typeof input!=="object")return new Map<string,number>();
  const entries=Object.entries(input);
  const ids=new Set<number>();
  const result=new Map<string,number>();
  if(entries.length>20)return result;
  for(const [member,value] of entries) {
   const id=positiveId(value);
   if(!targetPattern.test(member)||!id||ids.has(id))return new Map<string,number>();
   ids.add(id);result.set(member,id);
  }
  return result;
 }catch{return new Map<string,number>();}
}
/** Strictly limited cross-service read; no credentials or generic proxies cross this boundary. */
export async function studioTeamPaySchedule(request:Request,{
 env=process.env,clock=()=>new Date(),readWeek=readHubPayWeek
}:{env?:NodeJS.ProcessEnv;clock?:()=>Date;readWeek?:typeof readHubPayWeek}={}){
 const url=new URL(request.url),secret=env.TEAM_PAY_BRIDGE_SECRET;
 if(env.TEAM_PAY_STUDIO_SCHED_ENABLED!=="true"||url.pathname!==STUDIO_TEAM_PAY_SCHEDULE_PATH)return safe(404,{state:"not_found"});
 if(request.method!=="POST"||url.search||secret==null||secret.length<43||secret.length>256||
  request.headers.get("content-type")?.split(";")[0].trim()!=="application/json")return deny();
 try{
  const now=clock(),stamp=request.headers.get("x-helios-pay-ts"),signature=request.headers.get("x-helios-pay-signature");
  if(!stamp||!/^\d{10}$/.test(stamp)||Math.abs(Math.floor(+now/1000)-Number(stamp))>45||
   !signature||! /^[a-f0-9]{64}$/.test(signature))return deny();
  const text=await requestText(request);
  if(text===null)return deny();
  const expected=createHmac("sha256",secret).update(STUDIO_TEAM_PAY_SCHEDULE_PATH+"\n"+stamp+"\n"+text).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,"hex")))return deny();
  const body=JSON.parse(text);
  if(!body||Object.keys(body).sort().join(",")!=="action,memberId,weekStart"||body.action!=="team-pay-schedule"||
   typeof body.memberId!=="string"||!targetPattern.test(body.memberId))return deny();
  const week=payWeek(body.weekStart);
  const limit=currentPayWeek(now);
  if(!week||week.from>limit||Date.parse(limit+"T00:00:00Z")-Date.parse(week.from+"T00:00:00Z")>26*7*86_400_000)
   return safe(400,{state:"invalid_week"});
  const mapped=mappings(env.PORTAL_TEAM_HDPH_STAFF_MAP).get(body.memberId);
  if(!mapped)return deny();
  const token=env.HDPH_V3_TOKEN?.trim(),brandId=positiveId(env.HDPH_SUMMARY_BRAND_ID);
  if(!token||!brandId||!env.TEAM_PAY_WORKSPACE_ID||env.HDPH_SUMMARY_WORKSPACE_ID!==env.TEAM_PAY_WORKSPACE_ID||
   env.PORTAL_TEAM_HDPH_TIME_ZONE!=="America/Denver")return safe(503,{state:"unavailable"});
  const result=await readWeek({token,brandId,hubStaffId:mapped,weekStart:week.from});
  if(result.state!=="ready")return safe(503,{state:"unavailable"});
  return safe(200,{state:"ready",week,visits:result.visits});
 }catch{return safe(503,{state:"unavailable"});}
}
