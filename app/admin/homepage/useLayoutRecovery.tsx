"use client";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { normalizeHomepageCurationPreferences, validHomepageLayout, type HomepageCurationPreferences, type HomepageCurationSectionId } from '@/lib/homepage-curation-layout';
import { registerSettingsCopy, refreshSettingsCopies, subscribeSettingsCopies, readSettingsCopies, emptySettingsCopies } from '@/app/admin/settings/settingsDraftCopies';

export function useLayoutRecovery(userId:string,workspaceId:string,initialRevision:string,initial:HomepageCurationPreferences){
 const [draft,setDraft]=useState(()=>normalizeHomepageCurationPreferences(initial));
 const [status,setStatus]=useState('');const [saving,setSaving]=useState(false);const [held,setHeld]=useState(false);const [retained,setRetained]=useState<string|null>(null);
 const state=useRef({context:`${userId}:${workspaceId}`,alive:true,draft,revision:initialRevision,active:null as AbortController|null,held:false,dirty:false,attempted:null as HomepageCurationPreferences|null});
 const context=`${userId}:${workspaceId}`;
 const renderedContext=useRef(context);
 useLayoutEffect(()=>{renderedContext.current=context;},[context]);
 const copyKey=useRef({});const copies=useSyncExternalStore(subscribeSettingsCopies,readSettingsCopies,emptySettingsCopies);
 useEffect(()=>{
  const s=state.current;s.alive=true;
  const unregister=registerSettingsCopy(copyKey.current,()=>({scope:'private-homepage-layout',userId,workspaceId,revision:s.revision,draft:s.draft,attempted:s.attempted}));
  const warning=(event:BeforeUnloadEvent)=>{if(s.dirty||s.active){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',warning);
  return()=>{s.alive=false;s.active?.abort();s.active=null;unregister();window.removeEventListener('beforeunload',warning);};
 },[userId,workspaceId]);
 // The page keys this editor by user/workspace. Fail closed even if a caller omits that key.
 const current=(s:typeof state.current,controller:AbortController)=>s.alive&&s.context===context&&renderedContext.current===context&&s.active===controller;
 async function persist(snapshot:HomepageCurationPreferences,next:HomepageCurationPreferences){
  const s=state.current;
  if(!s.alive||s.context!==context||renderedContext.current!==context||snapshot!==s.draft||s.active||s.held||!validHomepageLayout(next))return;
  const frozen={order:[...next.order],collapsed:[...next.collapsed]};
  const controller=new AbortController();s.active=controller;s.draft=frozen;s.attempted=frozen;s.dirty=true;setDraft(frozen);setSaving(true);setRetained(null);setStatus('Saving private layout…');refreshSettingsCopies();
  const previousRevision=s.revision,requestId=crypto.randomUUID();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const result=await Promise.race([
    (async()=>{const response=await fetch('/api/admin/homepage-layout',{method:'PATCH',signal:controller.signal,headers:{'Content-Type':'application/json','x-layout-revision':previousRevision,'x-layout-request':requestId,'x-layout-workspace':workspaceId},body:JSON.stringify(frozen)});return{response,data:await response.json()};})(),
    new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'));},20000);}),
   ]);
   if(!current(s,controller))return;
   if(result.response.status===409)throw Error('conflict');
   const a=result.data?.acknowledgement;
   if(!result.response.ok||result.data?.success!==true||!a||a.protocol!==1||a.scope!=='private-homepage-layout'||a.intent!=='replace'||a.userId!==userId||a.workspaceId!==workspaceId||a.requestId!==requestId||a.previousRevision!==previousRevision||typeof a.revision!=='string'||!/^[a-f0-9]{64}$/.test(a.revision)||a.revision===previousRevision||!validHomepageLayout(result.data.preferences)||JSON.stringify({order:result.data.preferences.order,collapsed:result.data.preferences.collapsed})!==JSON.stringify(frozen))throw Error('unknown');
   s.revision=a.revision;s.dirty=false;s.attempted=null;setStatus('Confirmed saved. This layout is private.');
  }catch(error){if(current(s,controller)){s.held=true;setHeld(true);setStatus(error instanceof Error&&error.message==='conflict'?'Conflict: retain your layout and reload to reconcile.':'Outcome uncertain. Retain your layout and reload to reconcile. No write will be retried.');}}
  finally{clearTimeout(timer);if(current(s,controller)){s.active=null;setSaving(false);refreshSettingsCopies();}}
 }
 function reveal(id:HomepageCurationSectionId){
  const s=state.current;if(!s.alive||s.context!==context||renderedContext.current!==context||s.active||s.held||!s.draft.collapsed.includes(id))return;
  s.draft={...s.draft,collapsed:s.draft.collapsed.filter(value=>value!==id)};s.dirty=true;setDraft(s.draft);refreshSettingsCopies();
 }
 return{draft,persist,reveal,saving,held,status,panel:<section aria-label="Private layout recovery" className="space-y-3">{held&&<><label>Retained homepage drafts<textarea aria-label="Retained homepage drafts" readOnly value={copies} className="min-h-40 w-full bg-black p-3"/></label><p>Copy all drafts before reloading. Reload reads server state without resubmitting or restoring your choices.</p><label><input type="checkbox" checked={retained===copies} onChange={event=>setRetained(event.target.checked?copies:null)}/> I have retained all drafts shown above.</label><button type="button" disabled={retained!==copies} onClick={()=>{if(retained!==null&&retained===readSettingsCopies())window.location.reload();}}>Reload to reconcile</button></>}</section>};
}
