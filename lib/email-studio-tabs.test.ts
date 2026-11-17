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
  const code=ts.transpileModule(readFileSync(new URL("../app/admin/email-studio/EmailStudioTabs.tsx",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{exports,require:(key:string)=>{assert(key in imports,`Unexpected import ${key}`);return imports[key];},window,document:{getElementById:(id:string)=>({focus(){focus.push(id);},scrollIntoView(){}})},requestAnimationFrame:(fn:()=>void)=>{fn();return 1;},setTimeout:(fn:()=>void)=>{fn();return 1;},clearTimeout(){},decodeURIComponent});
  function nodes(node:any):any[]{return !node||typeof node!=="object"?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];}
  function render(){cursor=0;dirty=false;tree=exports.default({children:content.email,clientTools:content.client,deliveryHealth:content.health,showClientTools});for(const node of nodes(tree)){if(node.props?.ref){const element={focus(){focus.push(node.props.id);},scrollIntoView(){}};if(typeof node.props.ref==="function")node.props.ref(element);else node.props.ref.current=element;}}}
  function settle(){for(let i=0;i<12&&(dirty||effects.length);i++){if(dirty)render();while(effects.length)effects.shift()!();}}
  settle();
  const byId=(id:string)=>nodes(tree).find(node=>node.props?.id===id);
  const tab=(id:string)=>byId(`email-studio-tab-${id}`);
  const panel=(id:string)=>byId(`email-studio-panel-${id}`);
  return {content,focus,tab,panel,all:()=>nodes(tree),settle,hash:()=>window.location.hash,click(id:string){tab(id).props.onClick();settle();},key(id:string,key:string){let prevented=false;tab(id).props.onKeyDown({key,preventDefault(){prevented=true;}});settle();return prevented;},navigate(hash:string){window.location.hash=hash;for(const fn of listeners.get("hashchange")||[])fn();settle();},unmount(){for(const fn of cleanups)fn();},listenerCount:()=>listeners.get("hashchange")?.size||0};
}
function selected(ui:ReturnType<typeof mount>,id:string) {assert.equal(ui.tab(id).props["aria-selected"],true);assert.equal(ui.tab(id).props.tabIndex,0);assert.equal(!!ui.panel(id).props.hidden,false);assert.equal(ui.tab(id).props["aria-controls"],ui.panel(id).props.id);assert.equal(ui.panel(id).props["aria-labelledby"],ui.tab(id).props.id);}

test("Email workspace is the default accessible tab, with inactive panels retained",()=>{const ui=mount();selected(ui,"email");assert.equal(ui.all().filter(n=>n.props?.role==="tablist").length,1);for(const id of ["client-tools","delivery-health"]){assert.equal(ui.tab(id).props.role,"tab");assert.equal(ui.tab(id).props.tabIndex,-1);assert.equal(ui.panel(id).props.role,"tabpanel");assert.equal(ui.panel(id).props.hidden,true);}});
test("switching tabs keeps child identities and unsaved content mounted without changing hash",()=>{const ui=mount();const panels=["email","client-tools","delivery-health"];const children=[ui.content.email,ui.content.client,ui.content.health];ui.content.email.props.value="edited draft still here";for(const id of ["client-tools","delivery-health","email"]){ui.click(id);selected(ui,id);panels.forEach((key,index)=>assert.ok([ui.panel(key).props.children].flat().includes(children[index])));}assert.equal(ui.content.email.props.value,"edited draft still here");assert.equal(ui.hash(),"");});
test("arrow keys wrap, Home/End focus and activate tabs, unrelated keys do not",()=>{const ui=mount();for(const [from,key,to] of [["email","ArrowRight","client-tools"],["client-tools","ArrowRight","delivery-health"],["delivery-health","ArrowRight","email"],["email","ArrowLeft","delivery-health"],["delivery-health","Home","email"],["email","End","delivery-health"]]){assert.equal(ui.key(from,key),true);selected(ui,to);assert.equal(ui.focus.at(-1),`email-studio-tab-${to}`);}assert.equal(ui.key("delivery-health","x"),false);selected(ui,"delivery-health");});
test("role restrictions omit Client Tools and keyboard navigation skips it",()=>{const ui=mount({showClientTools:false,hash:"#client-tools"});assert.equal(ui.tab("client-tools"),undefined);assert.equal(ui.panel("client-tools"),undefined);selected(ui,"email");ui.key("email","ArrowRight");selected(ui,"delivery-health");ui.key("delivery-health","ArrowRight");selected(ui,"email");});
test("health deep links and browser hash changes activate matching panels",()=>{for(const hash of ["#analytics-health","#webhook-health","#delivery-health"]){const ui=mount({hash});selected(ui,"delivery-health");}const ui=mount({hash:"#client-tools"});selected(ui,"client-tools");ui.navigate("#analytics-health");selected(ui,"delivery-health");ui.navigate("#email-workspace");selected(ui,"email");});
test("hashchange listener is removed on unmount",()=>{const ui=mount();assert.equal(ui.listenerCount(),1);ui.unmount();assert.equal(ui.listenerCount(),0);});


test("selected tabs match the subtle audience-card treatment without removing keyboard focus", () => {
  const ui = mount();
  for (const id of ["email", "client-tools", "delivery-health"]) {
    ui.click(id);
    const classes = ui.tab(id).props.className.split(/\s+/);
    for (const token of ["border", "border-[var(--helios-orange)]/50", "bg-[var(--helios-orange)]/10", "text-white", "focus-visible:outline-2"]) assert.ok(classes.includes(token), token);
    assert.ok(!classes.includes("bg-[var(--helios-orange)]"));
    assert.ok(!classes.includes("text-black"));
    selected(ui, id);
    for (const other of ["email", "client-tools", "delivery-health"].filter(other => other !== id)) assert.ok(ui.tab(other).props.className.includes("border-transparent"));
  }
});
