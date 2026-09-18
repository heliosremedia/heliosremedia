import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import HomepageCurationOrganizer from '../../app/admin/homepage/HomepageCurationOrganizer';
import {HOMEPAGE_CURATION_SECTION_IDS as ids, DEFAULT_HOMEPAGE_CURATION_PREFERENCES as initial} from '../../lib/homepage-curation-layout';
const nativeTimeout=window.setTimeout.bind(window);
window.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,ms===20000?120:ms,...args);
window.layout={mode:'success',requests:[],pending:[],revision:'a'.repeat(64)};
window.fetch=async(_url,options)=>{
 const state=window.layout;state.requests.push(options);const mode=state.mode;
 const response=()=>{const ack={protocol:1,scope:'private-homepage-layout',intent:'replace',userId:'u',workspaceId:'a',requestId:options.headers['x-layout-request'],previousRevision:options.headers['x-layout-revision'],revision:state.revision==='b'.repeat(64)?'c'.repeat(64):'b'.repeat(64)};
 if(mode==='workspace')ack.workspaceId='b';if(mode==='revision')ack.revision=ack.previousRevision;if(mode==='identity')ack.userId='other';
 state.revision=ack.revision;return Response.json({success:true,preferences:JSON.parse(options.body),acknowledgement:ack});};
 if(mode==='lost')throw Error('lost');if(mode==='conflict')return Response.json({success:false},{status:409});
 if(mode==='json')return {ok:true,status:200,json:async()=>{throw Error('json');}};
 if(mode==='timeout')return new Promise(resolve=>state.pending.push(()=>resolve(response())));
 if(mode==='json-timeout')return {ok:true,status:200,json:()=>new Promise(()=>{})};
 return response();
};
function Fixture(){const [key,setKey]=useState(0);useEffect(()=>{window.layout.remount=()=>setKey(k=>k+1);},[]);return <HomepageCurationOrganizer key={key} initialRevision={'a'.repeat(64)} userId="u" workspaceId="a" initialPreferences={initial} sections={ids.map(id=>({id,title:id,description:'Private editor section',content:<input aria-label={`Sibling ${id}`} defaultValue="Sibling draft"/>}))}/>;}
createRoot(document.getElementById('root')).render(<Fixture/>);
