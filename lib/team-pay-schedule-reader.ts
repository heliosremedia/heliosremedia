// Only a single documented V3 read operation is reachable; HTTP POST is its search protocol.
// Neither caller parameters nor upstream responses are returned verbatim to the client.
const ENDPOINT="https://api.hd.pics/order-views/search";
const PAGE=25,MAX_PAGES=4,MAX_TASKS=250,MAX_VISITS=99,MAX_BYTES=1_250_000;
const dayMs=86_400_000;
const row=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:null;
export const positiveId=(v:unknown)=>typeof v==="string"&&!/^[1-9]\d{0,15}$/.test(v)?0:
  (typeof v==="number"||typeof v==="string")&&Number.isSafeInteger(Number(v))&&Number(v)>0?Number(v):0;
const date=(v:unknown)=>{
 if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return null;
 const d=new Date(v+"T00:00:00Z");
 return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v?d:null;
};
export function payWeek(weekStart:unknown){
 const start=date(weekStart);
 if(!start||start.getUTCDay()!==1||typeof weekStart!=="string")return null;
 return {from:weekStart,through:new Date(+start+6*dayMs).toISOString().slice(0,10)};
}
const localDate=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Denver",year:"numeric",month:"2-digit",day:"2-digit"});
export function currentPayWeek(now:Date){
 const parts=Object.fromEntries(localDate.formatToParts(now).map(({type,value})=>[type,value]));
 const current=date(parts.year+"-"+parts.month+"-"+parts.day)!;
 return new Date(+current-((current.getUTCDay()+6)%7)*dayMs).toISOString().slice(0,10);
}
const value=(v:unknown,max:number)=>typeof v==="string"&&!/[\u0000-\u001f\u007f]/.test(v)?v.trim().slice(0,max):"";
function clockLabel(minute:number){
 const hour=Math.floor(minute/60);
 return (hour%12||12)+":"+String(minute%60).padStart(2,"0")+" "+(hour<12?"AM":"PM");
}
function dateRangeIncludes(d:string,week:{from:string;through:string}){return d>=week.from&&d<=week.through;}
const parseLocal=(v:unknown,week:{from:string;through:string})=>{
 if(typeof v!=="string")throw Error();
 const m=/^(\d{4}-\d\d-\d\d)(?:T([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(\.\d{1,7})?)?)?$/.exec(v);
 if(!m)throw Error();
 const d=date(m[1]);
 if(!d)throw Error();
 if(!dateRangeIncludes(m[1],week))return null;
 if(m[2]===undefined)throw Error(); // in-scope date-only lines do not prove a clocked visit
 const hour=Number(m[2]), minute=hour*60+Number(m[3]);
 // US Mountain local DST has one skipped or repeated hour. No offset was supplied.
 if(d.getUTCDay()===0&&((d.getUTCMonth()===2&&d.getUTCDate()>=8&&d.getUTCDate()<=14&&hour===2)||
   (d.getUTCMonth()===10&&d.getUTCDate()<=7&&hour===1)))throw Error();
 return {date:m[1],minute,second:Number(m[4]||0)+Number(m[5]||0)};
};
async function replyJSON(response:Response){
 if(!response.ok||!response.body||Number(response.headers.get("content-length"))>MAX_BYTES)throw Error();
 const reader=response.body.getReader();const decoder=new TextDecoder("utf-8",{fatal:true});
 let size=0,out="";
 try{
  for(;;){
   const {value,done}=await reader.read();
   if(done)break;
   size+=value.byteLength;
   if(size>MAX_BYTES){await reader.cancel();throw Error();}
   out+=decoder.decode(value,{stream:true});
  }
 }finally{reader.releaseLock();}
 return JSON.parse(out+decoder.decode());
}
export type HubVisit={orderId:number,date:string,minute:number,staffId:number,taskIds:number[],anchors:string[],
 address:string,city:string,timeLabel:string,timeRange:string};
type WeekResponse={state:"ready"|"unavailable";visits:HubVisit[]};
export async function readHubPayWeek({token,brandId,hubStaffId,weekStart,fetcher=fetch}:{
  token:string;brandId:number;hubStaffId:number;weekStart:string;fetcher?:typeof fetch;
}):Promise<WeekResponse>{
 const week=payWeek(weekStart);
 const unavailable:WeekResponse={state:"unavailable",visits:[]};
 // The configured provider contract uses a GUID, never infer from request data.
 if(!week||!positiveId(brandId)||!positiveId(hubStaffId)||!/^\S{8,250}$/.test(token))return unavailable;
 const deadline=AbortSignal.timeout(12_000), visits=new Map<string,HubVisit>(), secondByVisit=new Map<string,number>();
 const orders=new Set<number>(), seenTaskIds=new Set<number>();
 let offset=0;
 try{
  for(let page=0;page<MAX_PAGES;page++){
   if(deadline.aborted)return unavailable;
   const response=await fetcher(ENDPOINT,{method:"POST",redirect:"error",cache:"no-store",signal:deadline,credentials:"omit",
    headers:{"Content-Type":"application/json","Accept":"application/json","hd-token":token},
    body:JSON.stringify({shootDateFrom:week.from,shootDateTo:week.through,users:[hubStaffId],offset,quantity:PAGE,sort:"orderdate"})});
   const payload=row(await replyJSON(response));
   if(!payload||!Array.isArray(payload.data)||payload.data.length>PAGE)return unavailable;
   for(const result of payload.data){
    const item=row(result);
    if(!item||!positiveId(item.brandId))return unavailable;
    if(positiveId(item.brandId)!==brandId)continue; // Search includes accessible sub-brands.
    const orderId=positiveId(item.orderId);
    if(!orderId||orders.has(orderId)||!["incomplete","complete"].includes(String(item.status)))return unavailable;
    orders.add(orderId);
    if(!Array.isArray(item.tasks)||!item.tasks.length||item.tasks.length>MAX_TASKS)return unavailable;
    const loc=row(item.location);
    for(const candidate of item.tasks){
     const task=row(candidate);
     if(!task||!positiveId(task.taskId))return unavailable;
     const taskId=positiveId(task.taskId);
     if(seenTaskIds.has(taskId))return unavailable;
     seenTaskIds.add(taskId);
     if(task.taskStatus==="cancelled"||task.taskStatus==="system")continue;
     if(!["undone","done"].includes(String(task.taskStatus)))return unavailable;
     // The two order-level predicates can match different tasks. Only this single row decides.
     if(positiveId(task.teamMemberId)!==hubStaffId||task.shoot==null)continue;
     const appointment=parseLocal(task.shoot,week);
     if(!appointment)continue;
     const key=JSON.stringify([orderId,appointment.date,appointment.minute]);
     const existing=visits.get(key);
     if(existing){
      if(secondByVisit.get(key)!==appointment.second)return unavailable;
      existing.taskIds.push(taskId);existing.anchors.push(orderId+":"+taskId);
     }else{
      if(visits.size>=MAX_VISITS)return unavailable;
      secondByVisit.set(key,appointment.second);
      const label=clockLabel(appointment.minute);
      visits.set(key,{orderId,date:appointment.date,minute:appointment.minute,staffId:hubStaffId,
        taskIds:[taskId],anchors:[orderId+":"+taskId],address:value(loc?.address,160),city:value(loc?.city,70),
        timeLabel:label,timeRange:label});
     }
    }
   }
   if(payload.nextOffset==null){
    // The spec guarantees that only a short page is the end; otherwise completeness is unknown.
    if(payload.data.length===PAGE)return unavailable;
    return {state:"ready",visits:[...visits.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.minute-b.minute||a.orderId-b.orderId)};
   }
   const next=positiveId(payload.nextOffset);
   if(next!==offset+payload.data.length||!payload.data.length)return unavailable;
   offset=next;
  }
 }catch{}
 return unavailable;
}
