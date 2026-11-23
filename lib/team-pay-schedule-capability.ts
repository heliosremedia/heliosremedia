import {readHubPayWeek,payWeek} from "./team-pay-schedule-reader.ts";

const BRANCH="team-pay-schedule-bridge-preview-20261123";
const TARGET="/admin/team-pay-schedule-check";
const HELIOS_OWNER="cmrpuopf3000023oa12gui7th";
const HELIOS_WORKSPACE="helios-default-workspace";
const HELIOS_BRAND=7708;
const AUSTIN_ID=655257;
const FIXED_WEEK="2026-11-16";
type Actor={id:string;role:string;workspaceId:string};
const h={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none';frame-ancestors 'none'","X-Frame-Options":"DENY"};
const response=(status:number,value:unknown)=>Response.json(value,{status,headers:h});

/** One preview branch, date range, person, owner. Cannot be widened via request data. */
export async function teamPayScheduleCapability(request:Request,{env=process.env,readActor,readWeek=readHubPayWeek}:{
 env?:NodeJS.ProcessEnv;readActor:()=>Promise<Actor|null>;readWeek?:typeof readHubPayWeek;
}){
 const url=new URL(request.url);
 if(env.VERCEL_ENV!=="preview"||env.VERCEL_GIT_COMMIT_REF!==BRANCH||url.pathname!==TARGET)return response(404,{state:"not_found"});
 if(request.method!=="GET"||url.search)return response(400,{state:"invalid_request"});
 try{
  const actor=await readActor();
  if(!actor)return new Response(null,{status:303,headers:{...h,Location:"/login?next="+encodeURIComponent(TARGET)}});
  if(actor.id!==HELIOS_OWNER||actor.role!=="OWNER"||actor.workspaceId!==HELIOS_WORKSPACE)return response(403,{state:"forbidden"});
  const week=payWeek(FIXED_WEEK);
  const token=env.HDPH_V3_TOKEN?.trim();
  if(!token||env.HDPH_SUMMARY_WORKSPACE_ID!==HELIOS_WORKSPACE||env.HDPH_SUMMARY_BRAND_ID!==String(HELIOS_BRAND))
   return response(503,{state:"missing_preview_configuration",week,visitCount:null,taskCount:null});
  const result=await readWeek({token,brandId:HELIOS_BRAND,hubStaffId:AUSTIN_ID,weekStart:FIXED_WEEK});
  if(result.state!=="ready")return response(503,{state:"source_unavailable",week,visitCount:null,taskCount:null});
  const taskCount=result.visits.reduce((n,v)=>n+v.taskIds.length,0);
  return response(200,{state:"ready",week,visitCount:result.visits.length,taskCount});
 }catch{return response(503,{state:"unavailable",week:payWeek(FIXED_WEEK),visitCount:null,taskCount:null});}
}
