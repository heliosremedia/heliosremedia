/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated action harness; no network or sending. */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const source=readFileSync(new URL("../app/admin/email-studio/BulkEmailStudio.tsx",import.meta.url),"utf8");
const parsed=ts.createSourceFile("BulkEmailStudio.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function actionSource(name:string) { let result="";function visit(node:ts.Node){if(ts.isFunctionDeclaration(node)&&node.name?.text===name)result=node.getText(parsed);ts.forEachChild(node,visit);}visit(parsed);assert.ok(result, name);return result; }
const campaign={id:"draft",subject:"Saved subject",previewText:"Preview",body:"Saved body",templateKey:"PERSONAL_LETTER",recipientMode:"INDIVIDUALS",selection:{clientIds:["client-a"],groupIds:[]},rowVersion:7};
function actions(confirmed=true,success=true) {
 const state:any={composerRequest:0,history:[campaign],subject:"Unsaved content",previewText:"",body:"",draftId:"other",message:null,busy:null};
 const calls:any[]=[];let resolveFetch:(value:any)=>void=()=>{};
 const context:any={subject:state.subject,previewText:"",body:"",draftId:"other",window:{confirm:()=>confirmed,scrollTo(){}},normalizeEmailTemplateKey:(v:any)=>v,restoreCampaignImage(){},fetch:(url:string,init:any)=>{calls.push({url,init});return new Promise(resolve=>{resolveFetch=resolve;});}};
 for(const name of ["Subject","PreviewText","Body","TemplateKey","Mode","GroupIds","ClientIds","DraftId","ViewingCampaign","Message","Busy","History","ComposerRequest"])context[`set${name}`]=(value:any)=>{const key=name[0].toLowerCase()+name.slice(1);state[key]=typeof value==="function"?value(state[key]):value;};
 const compiled=ts.transpileModule(actionSource("resumeDraft")+"\n"+actionSource("manageCampaign"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(compiled,context);
 return {state,calls,resume:()=>context.resumeDraft(campaign),manage:(action:string)=>context.manageCampaign(campaign,action),finish(){resolveFetch({ok:success,json:async()=>success?{success:true}:{success:false,error:"Synthetic server rejection"}});}};
}
test("Resume Draft requests composer only after confirming content replacement, without sending",()=>{
 const cancelled=actions(false);cancelled.resume();assert.equal(cancelled.state.composerRequest,0);assert.equal(cancelled.state.subject,"Unsaved content");assert.equal(cancelled.calls.length,0);
 const approved=actions();approved.resume();assert.equal(approved.state.composerRequest,1);assert.equal(approved.state.subject,campaign.subject);assert.equal(approved.state.draftId,campaign.id);assert.match(approved.state.message.text,/Draft reopened/);assert.equal(approved.calls.length,0);
});
test("scheduled Edit activates composer only after successful versioned mutation",async()=>{
 const cancelled=actions(false);await cancelled.manage("edit");assert.equal(cancelled.calls.length,0);assert.equal(cancelled.state.composerRequest,0);
 for(const success of [false,true]){const ui=actions(true,success);const pending=ui.manage("edit");assert.equal(ui.state.composerRequest,0);assert.equal(ui.calls.length,1);assert.equal(ui.calls[0].init.method,"PATCH");assert.deepEqual(JSON.parse(ui.calls[0].init.body),{action:"edit",rowVersion:7});ui.finish();await pending;assert.equal(ui.state.composerRequest,success?1:0);assert.equal(ui.state.busy,null);assert.equal(ui.state.message.tone,success?"ok":"error");if(!success)assert.equal(ui.state.subject,"Unsaved content");}
});
test("History errors and cancellation status do not force composer activation",async()=>{
 for(const success of [false,true]){const ui=actions(true,success);const pending=ui.manage("cancel");ui.finish();await pending;assert.equal(ui.state.composerRequest,0);assert.equal(ui.state.message.tone,success?"ok":"error");}
});
test("History is a sibling slot; status and all dialogs are outside the tab wrapper",()=>{
 const start=source.indexOf("<EmailStudioTabs "),end=source.indexOf("</EmailStudioTabs>");assert.ok(start>0&&end>start);
 assert.equal((source.match(/<EmailStudioTabs /g)||[]).length,1);
 assert.match(source.slice(start,end),/campaignHistory=\{<section/);
 assert.equal((source.match(/history\.map\(/g)||[]).length,1);
 const status=source.indexOf('{message && <p role="status"');assert.ok(status>0&&(status<start||status>end),"action messages must remain visible from History");
 for(const title of ["expanded-preview-title","media-picker-title","schedule-title","sent-email-title"]){const location=source.indexOf(`aria-labelledby="${title}"`);assert.ok(location>end,`${title} must be outside hidden panels`);}
 assert.match(source,/historyTriggerRef\.current\?\.focus\(\)/);
 assert.match(source,/Historical content is not regenerated/);
 assert.match(source,/composerRequest=\{composerRequest\}/);
});

test("History uses the shared Studio card typography with explicit list spacing",()=>{assert.match(source, /<AdminCardHeading eyebrow="Campaign records" title="Campaign History" description="Resume drafts, manage scheduled campaigns, or inspect delivered email snapshots\." \/><div className="mt-5 divide-y/);});
