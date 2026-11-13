/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as core from "../../../lib/events/resend-core.ts";
const uuid="12345678-1234-4234-9234-123456789abc";
function mount() {
 let event:any={id:"event",title:"Holiday gathering",status:"SCHEDULED",startsAt:"2035-01-01T18:00:00Z",deliveries:[{stage:"INITIAL",status:"COMPLETED",scheduledAt:"2026-01-01T18:00:00Z",messages:[{invitationId:"invite0",status:"SENT"}]}]},disabled=false;
 const recipient={id:"invite0",displayName:"Ada Client",email:"ada@example.test"};
 const calls:{path:string;body:any;resolve:(r:Response)=>void;reject:(e:Error)=>void}[]=[];
 const slots:any[]=[],updates:any[]=[];let cursor=0,dirty=true,tree:any,ids=0;
 const hooks={useState(initial:any){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],(next:any)=>{slots[i]=typeof next==="function"?next(slots[i]):next;dirty=true;}];},useRef(value:any){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i];}};
 const jsx=(type:any,props:any)=>({type,props}),exports:any={};
 const imports:any={react:hooks,"react/jsx-runtime":{jsx,jsxs:jsx},"@/lib/events/resend-core":core};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL("./ResendInvitation.tsx",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:(key:string)=>{assert(key in imports);return imports[key];},Date,JSON,Error,crypto:{randomUUID:()=>{ids++;return uuid;}},fetch:(path:string,init:any)=>{assert.equal(init.method,"POST");return new Promise((resolve,reject)=>calls.push({path,body:JSON.parse(init.body),resolve,reject}));}});
 const nodes=(node:any):any[]=>!node||typeof node!=="object"?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
 const text=(node:any):string=>node==null?"":typeof node!=="object"?String(node):Array.isArray(node)?node.map(text).join(""):text(node.props?.children);
 const button=(label:string)=>nodes(tree).find(n=>n.type==="button"&&text(n)===label);
 function render(){cursor=0;dirty=false;tree=exports.default({event,recipient,disabled,onChange:(next:any)=>{updates.push(next);event=next;dirty=true;}});}
 async function settle(){for(let i=0;i<6;i++){if(dirty)render();await new Promise(r=>setImmediate(r));}}
 return {settle,button,calls,updates,text:()=>text(tree),event:()=>event,ids:()=>ids,setEvent:(change:any)=>{event={...event,...change};dirty=true;},disable:()=>{disabled=true;dirty=true;},success:()=>calls.at(-1)!.resolve(Response.json({success:true,event:{...event,deliveries:[...event.deliveries,{stage:core.resendStage("invite0",uuid),status:"SCHEDULED",scheduledAt:new Date().toISOString(),messages:[]}]},message:"Queued for this guest only."}))};
}
test("individual resend requires a second explicit confirmation showing address and event",async()=>{
 const ui=mount();await ui.settle();assert.equal(ui.button("Resend invite").props.disabled,false);
 ui.button("Resend invite").props.onClick();await ui.settle();assert.equal(ui.calls.length,0);assert.match(ui.text(),/Holiday gathering.*ada@example.test.*only/);assert.match(ui.text(),/RSVP and guest count stay unchanged/);
 ui.button("Cancel").props.onClick();await ui.settle();assert.equal(ui.calls.length,0);
 ui.button("Resend invite").props.onClick();await ui.settle();const confirm=ui.button("Confirm resend").props.onClick;confirm();confirm();await ui.settle();
 assert.equal(ui.calls.length,1);assert.equal(ui.calls[0].path,"/api/admin/events/event/resend");assert.deepEqual(ui.calls[0].body,{invitationId:"invite0",recipientEmail:"ada@example.test",requestId:uuid,confirm:true});assert.equal(ui.button("Cancel").props.disabled,true);
 ui.success();await ui.settle();assert.equal(ui.updates.length,1);assert.equal(ui.button("Resend invite").props.disabled,true);assert.match(ui.text(),/Queued for this guest only/);
});
test("lost-response retries retain same request id, and a cancel never creates another send",async()=>{
 const ui=mount();await ui.settle();ui.button("Resend invite").props.onClick();await ui.settle();ui.button("Confirm resend").props.onClick();await ui.settle();ui.calls[0].reject(new Error("Network interrupted"));await ui.settle();
 assert.match(ui.text(),/Network interrupted/);assert.equal(ui.updates.length,0);ui.button("Cancel").props.onClick();await ui.settle();assert.equal(ui.calls.length,1);
 ui.button("Resend invite").props.onClick();await ui.settle();ui.button("Confirm resend").props.onClick();await ui.settle();assert.equal(ui.calls.length,2);assert.deepEqual(ui.calls[1].body,ui.calls[0].body);assert.equal(ui.ids(),1);
 ui.success();await ui.settle();assert.equal(ui.button("Resend invite").props.disabled,true);
});
test("closed events, uncertain original and global operations disable resend without a request",async()=>{
 for(const change of [{status:"CANCELLED"},{startsAt:"2000-01-01T00:00:00Z"},{deliveries:[{stage:"INITIAL",status:"FAILED",scheduledAt:"2026-01-01",messages:[{invitationId:"invite0",status:"UNCERTAIN"}]}]}]){
  const ui=mount();ui.setEvent(change);await ui.settle();assert.equal(ui.button("Resend invite").props.disabled,true);assert.equal(ui.calls.length,0);
 }
 const ui=mount();await ui.settle();ui.button("Resend invite").props.onClick();await ui.settle();ui.disable();await ui.settle();ui.button("Confirm resend").props.onClick();await ui.settle();assert.equal(ui.calls.length,0);
});
