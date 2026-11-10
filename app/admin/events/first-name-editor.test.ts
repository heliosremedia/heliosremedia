/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { insertEventFirstName } from "./first-name-editor.ts";
import * as themes from "../../../lib/events/themes.ts";
import * as helpers from "./ui-helpers.ts";

test("first-name insertion preserves suggested copy, selection and surrounding text", () => {
  assert.deepEqual(insertEventFirstName({field:"body",value:"",suggested:"Join us."}), {text:"Hi {{FIRST_NAME}},\n\nJoin us.",caret:20});
  assert.deepEqual(insertEventFirstName({field:"subject",value:"",suggested:"You're invited"}), {text:"{{FIRST_NAME}}, You're invited",caret:16});
  assert.deepEqual(insertEventFirstName({field:"body",value:"Hi Jane, welcome!",suggested:"Unused",selectionStart:3,selectionEnd:7}), {text:"Hi {{FIRST_NAME}}, welcome!",caret:17});
  assert.deepEqual(insertEventFirstName({field:"subject",value:"For ",suggested:"Unused",selectionStart:4,selectionEnd:4}), {text:"For {{FIRST_NAME}}",caret:18});
  assert.deepEqual(insertEventFirstName({field:"body",value:"Before after",suggested:"Unused",selectionStart:7,selectionEnd:7}), {text:"Before {{FIRST_NAME}}after",caret:21});
});

test("insertion rejects over-limit expansion rather than truncating existing text", () => {
  assert.match(insertEventFirstName({field:"subject",value:"x".repeat(200),suggested:""}).error!, /200/);
  assert.match(insertEventFirstName({field:"body",value:"",suggested:"x".repeat(10000)}).error!, /10,000/);
  assert.equal(insertEventFirstName({field:"subject",value:"x".repeat(200),suggested:"",selectionStart:0,selectionEnd:14}).text?.length,200);
});

function mount(initial: themes.EventEmailContent = {}) {
  let value = initial, cursor = 0, dirty = true, tree: any, jobs: (() => void)[] = [], disabled = false, focus = "";
  const slots: any[] = [], updates: themes.EventEmailContent[] = [];
  const elements = {
    subject:{selectionStart:0,selectionEnd:0,focus(){focus="subject";},setSelectionRange(start:number,end:number){this.selectionStart=start;this.selectionEnd=end;}},
    body:{selectionStart:0,selectionEnd:0,focus(){focus="body";},setSelectionRange(start:number,end:number){this.selectionStart=start;this.selectionEnd=end;}},
  };
  const hooks = {
    useState(initial:any){const index=cursor++;if(!(index in slots))slots[index]=initial;return [slots[index],(next:any)=>{slots[index]=next;dirty=true;}];},
    useRef(initial:any){const index=cursor++;if(!(index in slots))slots[index]={current:initial};return slots[index];},
    useLayoutEffect(effect:()=>void,deps:any[]){const index=cursor++,previous=slots[index];if(!previous||deps.some((dep,i)=>!Object.is(dep,previous[i])))jobs.push(()=>{slots[index]=deps;effect();});},
  };
  const jsx=(type:unknown,props:unknown)=>({type,props});
  const imports:any={react:hooks,"react/jsx-runtime":{jsx,jsxs:jsx},"./EventAIWriter":{default:()=>null},"@/lib/events/themes":themes,"./ui-helpers":helpers,"./first-name-editor":{insertEventFirstName}};
  const exports:any={};
  const js=ts.transpileModule(readFileSync(new URL("./EventEmailCopy.tsx",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(js,{exports,require:(name:string)=>{assert(name in imports,`Unexpected import ${name}`);return imports[name];}});
  const nodes=(node:any):any[]=>!node||typeof node!=="object"?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
  const text=(node:any):string=>node==null?"":typeof node!=="object"?String(node):Array.isArray(node)?node.map(text).join(""):text(node.props?.children);
  function render(){cursor=0;dirty=false;jobs=[];tree=exports.default({title:"Party",description:"Join us.",value,disabled,aiSource:{},onChange:(next:themes.EventEmailContent)=>{value=next;updates.push(next);dirty=true;}});for(const node of nodes(tree))if(node.props?.ref)node.props.ref.current=node.type==="input"?elements.subject:elements.body;for(const job of jobs)job();}
  function settle(){for(let i=0;i<6&&dirty;i++)render();}
  const find=(type:string,match:(node:any)=>boolean=()=>true)=>nodes(tree).find(node=>node.type===type&&match(node));
  const insert=(field:"subject"|"body")=>find("button",node=>node.props["aria-label"]===`Insert first name into ${field==="body"?"message":"subject"}`);
  const stage=(label:string)=>find("button",node=>text(node).startsWith(label));
  return {settle,find,insert,stage,elements,updates,allText:()=>text(tree),value:()=>value,focus:()=>focus,disable:()=>{disabled=true;dirty=true;}};
}

test("actual editor inserts into the selected field and restores focus/caret without changing other stages", () => {
  const initial={INITIAL:{subject:"Party",body:"Hi Jane, join us."},REMINDER:{subject:"Tomorrow",body:"See you"}};
  const ui=mount(initial);ui.settle();ui.elements.body.selectionStart=3;ui.elements.body.selectionEnd=7;
  let prevented=false;ui.insert("body").props.onMouseDown({preventDefault(){prevented=true;}});assert(prevented);
  ui.insert("body").props.onClick();ui.settle();
  assert.equal(ui.value().INITIAL?.body,"Hi {{FIRST_NAME}}, join us.");assert.equal(ui.value().INITIAL?.subject,"Party");assert.equal(ui.value().REMINDER,initial.REMINDER);
  assert.equal(ui.focus(),"body");assert.equal(ui.elements.body.selectionStart,17);assert.equal(ui.elements.body.selectionEnd,17);
  ui.insert("body").props.onClick();ui.settle();assert.equal(ui.value().INITIAL?.body,"Hi {{FIRST_NAME}}{{FIRST_NAME}}, join us.");assert.equal(ui.elements.body.selectionStart,31);
  ui.elements.subject.selectionStart=0;ui.elements.subject.selectionEnd=5;ui.insert("subject").props.onClick();ui.settle();assert.equal(ui.value().INITIAL?.subject,"{{FIRST_NAME}}");assert.equal(ui.focus(),"subject");
  assert.match(ui.allText(),/sample name Alex/);assert.match(ui.allText(),/Missing names become/);
  assert.equal(initial.INITIAL.body,"Hi Jane, join us.");
});

test("blank-stage insertion retains suggestions, switching stages preserves copy, and disabled/over-limit insertion cannot change it", () => {
  const ui=mount();ui.settle();ui.insert("body").props.onClick();ui.settle();assert.equal(ui.value().INITIAL?.body,"Hi {{FIRST_NAME}},\n\nParty\n\nJoin us.");assert.equal(ui.value().INITIAL?.subject,"");
  ui.stage("14-day follow-up").props.onClick();ui.settle();ui.insert("subject").props.onClick();ui.settle();assert.equal(ui.value().FOLLOW_UP?.subject,"{{FIRST_NAME}}, RSVP reminder: Party");assert.equal(ui.value().FOLLOW_UP?.body,"");
  ui.stage("Initial invitation").props.onClick();ui.settle();assert.equal(ui.find("textarea").props.value,ui.value().INITIAL?.body);
  ui.disable();ui.settle();const count=ui.updates.length;ui.insert("body").props.onClick();ui.settle();assert.equal(ui.updates.length,count);assert.equal(ui.find("fieldset").props.disabled,true);
  const full=mount({INITIAL:{subject:"x".repeat(200),body:"Keep me"}});full.settle();full.insert("subject").props.onClick();full.settle();assert.equal(full.updates.length,0);assert.match(full.find("p",node=>node.props.role==="alert").props.children,/Make room/);
  for(const field of ["subject","body"] as const)assert.equal(full.insert(field).props.type,"button");
});
