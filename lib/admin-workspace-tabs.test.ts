/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import ts from "typescript";

function mount({hash="",showClientTools=true}:{hash?:string;showClientTools?:boolean}={}) {
  const slots:any[]=[],effects:(()=>void)[]=[],cleanups:(()=>void)[]=[],listeners=new Map<string,Set<()=>void>>();
  const focus:string[]=[];
  let cursor=0,dirty=true,tree:any;
  const content={email:{type:"input",props:{value:"unsaved email draft"}},client:{type:"div",props:{children:"saved client selection"}},health:{type:"div",props:{children:"delivery report"}}};
  const hooks={
    useState(value:any){const index=cursor++;if(!(index in slots))slots[index]=typeof value==="function"?value():value;return [slots[index],(next:any)=>{slots[index]=typeof next==="function"?next(slots[index]):next;dirty=true;}];},
    useRef(value:any){const index=cursor++;if(!(index in slots))slots[index]={current:value};return slots[index];},
    useEffect(fn:()=>any,deps:any[]){const index=cursor++;const previous=slots[index];if(!previous || deps.some((value,i)=>value!==previous[i])){slots[index]=deps;effects.push(()=>{const cleanup=fn();if(typeof cleanup==="function")cleanups.push(cleanup);});}},
    useMemo(fn:()=>any){return fn();},useCallback(fn:any){return fn;},
  };
  const jsx=(type:any,props:any)=>({type,props}),exports:any={};
  const window={location:{hash},addEventListener(name:string,fn:()=>void){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name)!.add(fn);},removeEventListener(name:string,fn:()=>void){listeners.get(name)?.delete(fn);}};
  const imports:any={react:hooks,"react/jsx-runtime":{jsx,jsxs:jsx}};
  const code=ts.transpileModule(readFileSync(new URL("../app/admin/components/AdminWorkspaceTabs.tsx",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,require:(key:string)=>{assert(key in imports,`Unexpected import ${key}`);return imports[key];},window,document:{getElementById:(id:string)=>({focus(){focus.push(id);},scrollIntoView(){}})},requestAnimationFrame:(fn:()=>void)=>{fn();return 1;},setTimeout:(fn:()=>void)=>{fn();return 1;},clearTimeout(){},decodeURIComponent});
  function nodes(node:any):any[]{return !node||typeof node!=="object"?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];}
  function render(){cursor=0;dirty=false;tree=exports.default({id:"test-workspace",label:"Test sections",tabs:[{id:"email",label:"Email",content:content.email},...(showClientTools?[{id:"client-tools",label:"Tools",content:content.client}]:[]),{id:"delivery-health",label:"Health",hashAliases:["legacy-health-heading"],content:content.health}]});for(const node of nodes(tree)){if(node.props?.ref){const element={focus(){focus.push(node.props.id);},scrollIntoView(){}};if(typeof node.props.ref==="function")node.props.ref(element);else node.props.ref.current=element;}}}
  function settle(){for(let i=0;i<12&&(dirty||effects.length);i++){if(dirty)render();while(effects.length)effects.shift()!();}}
  settle();
  const byId=(id:string)=>nodes(tree).find(node=>node.props?.id===id);
  const tab=(id:string)=>byId(`test-workspace-tab-${id}`);
  const panel=(id:string)=>byId(`test-workspace-${id}`);
  return {content,focus,tab,panel,all:()=>nodes(tree),settle,hash:()=>window.location.hash,click(id:string){tab(id).props.onClick();settle();},key(id:string,key:string){let prevented=false;tab(id).props.onKeyDown({key,preventDefault(){prevented=true;}});settle();return prevented;},navigate(hash:string){window.location.hash=hash;for(const fn of listeners.get("hashchange")||[])fn();settle();},unmount(){for(const fn of cleanups)fn();},listenerCount:()=>listeners.get("hashchange")?.size||0};
}
function selected(ui:ReturnType<typeof mount>,id:string) {assert.equal(ui.tab(id).props["aria-selected"],true);assert.equal(ui.tab(id).props.tabIndex,0);assert.equal(!!ui.panel(id).props.hidden,false);assert.equal(ui.tab(id).props["aria-controls"],ui.panel(id).props.id);assert.equal(ui.panel(id).props["aria-labelledby"],ui.tab(id).props.id);}


test("workspace defaults to first tab and keeps all content mounted across switches",()=>{const ui=mount();selected(ui,"email");for(const id of ["client-tools","delivery-health","email"]){ui.click(id);selected(ui,id);assert.equal(ui.panel("email").props.children,ui.content.email);assert.equal(ui.panel("client-tools").props.children,ui.content.client);assert.equal(ui.panel("delivery-health").props.children,ui.content.health);}assert.equal(ui.hash(),"");});
test("keyboard navigation wraps with focus and role-limited tabs are omitted",()=>{const ui=mount({showClientTools:false});assert.equal(ui.tab("client-tools"),undefined);assert.equal(ui.key("email","ArrowLeft"),true);selected(ui,"delivery-health");assert.equal(ui.focus.at(-1),"test-workspace-tab-delivery-health");ui.key("delivery-health","Home");selected(ui,"email");ui.key("email","End");selected(ui,"delivery-health");assert.equal(ui.key("delivery-health","x"),false);});
test("namespaced deep links activate a panel and listeners clean up",()=>{const ui=mount({hash:"#test-workspace-client-tools"});selected(ui,"client-tools");ui.navigate("#test-workspace-delivery-health");selected(ui,"delivery-health");ui.navigate("#unrelated");selected(ui,"delivery-health");assert.equal(ui.listenerCount(),1);ui.unmount();assert.equal(ui.listenerCount(),0);});
test("active styling matches Email Studio subtle tabs and keeps visible focus",()=>{const ui=mount();const classes=ui.tab("email").props.className.split(/\s+/);for(const c of ["admin-workspace-tab","focus-visible:outline-2"])assert.ok(classes.includes(c));assert.ok(!classes.includes("text-black"));assert.ok(!classes.some(c=>c.startsWith("bg-[var(--helios-orange)]")));});

test("legacy heading aliases reveal their persistent panel on initial load and hash navigation",()=>{const ui=mount({hash:"#legacy-health-heading"});selected(ui,"delivery-health");ui.click("email");ui.navigate("#legacy-health-heading");selected(ui,"delivery-health");assert.equal(ui.panel("email").props.children,ui.content.email);});
