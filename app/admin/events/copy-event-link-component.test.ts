/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import ts from "typescript";
import {webcrypto} from "node:crypto";
function mount(file:string,imports:any={},clipboardWorks=true) {
 const slots:any[]=[],effects:(()=>void)[]=[],calls:any[]=[],copies:string[]=[],history:any[]=[];let cursor=0,dirty=true,tree:any;
 const hooks={useState(value:any){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],(v:any)=>{slots[i]=typeof v==="function"?v(slots[i]):v;dirty=true;}];},useRef(value:any){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i];},useEffect(fn:()=>void){const i=cursor++;if(!(i in slots)){slots[i]=true;effects.push(fn);}}};
 const jsx=(type:any,props:any)=>({type,props}),exports:any={};
 const modules:any={react:hooks,"react/jsx-runtime":{jsx,jsxs:jsx},...imports};
 const window={location:{origin:"https://example.test",pathname:"/events/invite",hash:"#token="+"A".repeat(43)},history:{replaceState(...args:any[]){history.push(args);window.location.hash="";}}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:(key:string)=>{assert(key in modules,key);return modules[key];},window,navigator:{clipboard:{async writeText(value:string){if(!clipboardWorks)throw new Error("denied");copies.push(value);}}},URL,URLSearchParams,AbortController,Uint8Array,btoa,crypto:webcrypto,Date,Intl,JSON,Error,fetch:(path:string,init:any)=>new Promise((resolve,reject)=>calls.push({path,init,resolve,reject}))});
 const nodes=(n:any):any[]=>!n||typeof n!=="object"?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
 const text=(n:any):string=>n==null?"":typeof n!=="object"?String(n):Array.isArray(n)?n.map(text).join(""):text(n.props?.children);
 async function settle(){for(let i=0;i<8;i++){if(dirty){cursor=0;dirty=false;tree=exports.default({eventId:"event"});while(effects.length)effects.shift()!();}await new Promise(r=>setImmediate(r));}}
 return {settle,calls,copies,history,text:()=>text(tree),find:(type:string)=>nodes(tree).find(n=>n.type===type),all:()=>nodes(tree),field:(name:string)=>nodes(tree).find(n=>n.props?.name===name),button:(label:string)=>nodes(tree).find(n=>n.type==="button"&&text(n)===label),resolve:(data:any,status=200)=>calls.at(-1).resolve(Response.json(data,{status}))};
}

test("share link is created only by explicit click; concurrent clicks make one request",async()=>{const ui=mount("./CopyEventLink.tsx");await ui.settle();assert.equal(ui.calls.length,0);assert.match(ui.text(),/Anyone with this link/);const click=ui.button("Copy Invite Link").props.onClick;click();click();await ui.settle();assert.equal(ui.calls.length,1);assert.equal(ui.calls[0].path,"/api/admin/events/event/share-link");assert.equal(ui.calls[0].init.cache,"no-store");ui.resolve({success:true,url:"https://example.test/events/invite#token="+"A".repeat(43)});await ui.settle();assert.equal(ui.copies.length,1);assert.match(ui.text(),/Invite link copied/);});
test("clipboard denial provides selectable readonly fallback; rejects personal tokens",async()=>{const ui=mount("./CopyEventLink.tsx",{},false);await ui.settle();ui.button("Copy Invite Link").props.onClick();await ui.settle();ui.resolve({success:true,url:"https://example.test/events/invite#token="+"B".repeat(43)});await ui.settle();assert.equal(ui.find("input").props.readOnly,true);let selected=false;ui.find("input").props.onFocus({currentTarget:{select(){selected=true;}}});assert.equal(selected,true);assert.match(ui.text(),/Select and copy/);const bad=mount("./CopyEventLink.tsx");await bad.settle();bad.button("Copy Invite Link").props.onClick();await bad.settle();bad.resolve({success:true,url:"https://example.test/events/rsvp#token="+"B".repeat(43)});await bad.settle();assert.equal(bad.copies.length,0);assert.match(bad.text(),/could not be verified/);});

test("canonical production origin works from preview but arbitrary hosts do not",async()=>{for(const [origin,allowed] of [["https://www.heliosrealestatemedia.com",true],["https://evil.example",false]] as const){const ui=mount("./CopyEventLink.tsx");await ui.settle();ui.button("Copy Invite Link").props.onClick();await ui.settle();ui.resolve({success:true,url:origin+"/events/invite#token="+"A".repeat(43)});await ui.settle();assert.equal(ui.copies.length,allowed?1:0);}});
