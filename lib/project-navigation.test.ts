import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
const require = createRequire(import.meta.url);
const ts = require("typescript");

test("click selection survives intermediate smooth scroll and manual scroll selects the reached section", () => {
  const effects: Array<() => unknown> = [], states: unknown[] = [], timers = new Map<number, () => void>();
  let timerId=0, scrollY=0;
  const listeners: Record<string, () => void> = {};
  const elements = ["details", "media", "services", "publish"].map((id,index)=>({id,top:index*500,tabIndex:0,focus(){},querySelector(){return null;},getBoundingClientRect(){return {top:this.top-scrollY};}}));
  const fakeWindow = { get scrollY(){return scrollY;}, history:{replaceState(){}}, matchMedia(){return {matches:false};}, scrollTo(){}, addEventListener(name:string,fn:()=>void){listeners[name]=fn;}, removeEventListener(){} };
  const react = {useContext:()=>"system",useRef:(value:unknown)=>({current:value}),useState:(value:unknown)=>{const index=states.length;states.push(value);return [value,(next:unknown)=>{states[index]=next;}];},useEffect:(effect:()=>unknown)=>effects.push(effect)};
  const jsx = (type:unknown,props:Record<string,unknown>)=>({type,props});
  const exports: {default?: (props:unknown)=>any} = {};
  const source=readFileSync(new URL("../app/admin/components/AdminSectionNavigator.tsx",import.meta.url),"utf8");
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    exports,require:(id:string)=>id==="react"?react:id==="react-dom"?{createPortal:(x:unknown)=>x}:{jsx,jsxs:jsx},
    window:fakeWindow,document:{getElementById:(id:string)=>elements.find(e=>e.id===id)},
    requestAnimationFrame:(fn:()=>void)=>{fn();return 1;},cancelAnimationFrame(){},
    setTimeout:(fn:()=>void)=>{timers.set(++timerId,fn);return timerId;},clearTimeout:(id:number)=>timers.delete(id),
  });
  const tree=exports.default!({label:"Steps",projectEditor:true,sections:elements.map((e,i)=>({href:`#${e.id}`,label:e.id,step:String(i+1)}))});
  tree.props.ref.current={getBoundingClientRect:()=>({height:100})};
  effects.forEach(effect=>effect());
  const buttons:any[]=[];
  function walk(node:any){if(!node)return;if(Array.isArray(node)){node.forEach(walk);return;}if(node.type==="button")buttons.push(node);walk(node.props?.children);}
  walk(tree);
  buttons[2].props.onClick();
  assert.equal(states[0],"services");
  scrollY=300; listeners.scroll(); // traversing media cannot undo selected step
  assert.equal(states[0],"services");
  scrollY=804;listeners.scroll();
  [...timers.values()].forEach(fn=>fn());timers.clear();
  assert.equal(states[0],"services"); // target is just under sticky nav
  scrollY=304;listeners.scroll();
  assert.equal(states[0],"media"); // manual scrolling restores normal tracking
  // Exercise every forward/backward transition, not only the reported 2 -> 3.
  for (const index of [0, 1, 2, 3, 2, 1, 0, 3]) {
    buttons[index].props.onClick();
    assert.equal(states[0], elements[index].id);
    scrollY=250; listeners.scroll();
    assert.equal(states[0], elements[index].id);
    scrollY=Math.max(0, index*500-196); listeners.scroll();
    [...timers.values()].forEach(fn=>fn()); timers.clear();
    assert.equal(states[0], elements[index].id);
  }
});
