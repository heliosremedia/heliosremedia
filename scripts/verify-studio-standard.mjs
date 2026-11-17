/** Reconstructed verification: actual components and handlers, no external actions. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
const require=createRequire(import.meta.url);
const read=p=>fs.readFileSync(p,'utf8');
function load(path, dependencies={}) {
 const compiledModule={exports:{}};
 const code=ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(code,{exports:compiledModule.exports,module:compiledModule,require:name=>dependencies[name]||require(name)});
 return compiledModule.exports;
}
const {AdminButton}=load('app/admin/components/AdminButton.tsx');
for(const variant of ['primary','secondary','success','destructive']) {
 const html=renderToStaticMarkup(React.createElement(AdminButton,{variant,isLoading:true,type:'button'},'Verified'));
 assert.ok(html.includes(`admin-btn-${variant}`));
 for(const value of ['disabled=""','aria-busy="true"','type="button"'])assert.ok(html.includes(value));
}
const badge=load('app/admin/components/AdminStatusBadge.tsx');
for(const tone of ['neutral','success','warning','error']) {
 const html=renderToStaticMarkup(React.createElement(badge.default,{tone},'Connected · publishing disabled'));
 assert.ok(html.includes(`admin-status-${tone}`));assert.ok(html.includes('Connected · publishing disabled'));
 assert.doesNotMatch(html,/role="(?:alert|status)"/);
}
const disclosure=load('app/admin/components/AdminDisclosureSummary.tsx');
for(const open of [false,true]) {
 const html=renderToStaticMarkup(React.createElement('details',{open},React.createElement(disclosure.default,null,'Details'),React.createElement('input',{name:'draft',defaultValue:'Unsaved content'})));
 assert.match(html,/<summary class="admin-disclosure-summary">/);assert.match(html,/aria-hidden="true"/);assert.match(html,/name="draft" value="Unsaved content"/);
 assert.doesNotMatch(html,/<button|tabindex|aria-expanded/);assert.equal(html.includes('<details open="">'),open);
}
const deps={'@/app/admin/components/AdminStatusBadge':badge,'@/app/admin/components/AdminDisclosureSummary':disclosure};
const NewsletterBadge=load('app/admin/newsletter-studio/components/StatusBadge.tsx',deps).default;
for(const [status,tone] of [['APPROVED','success'],['SENT','success'],['SCHEDULED','neutral'],['NEEDS_REVIEW','warning'],['SEND_FAILED','error'],['PARTIALLY_SENT','error']]) assert.ok(renderToStaticMarkup(React.createElement(NewsletterBadge,{status})).includes(`admin-status-${tone}`));
const MetaPicker=load('app/admin/social-studio/settings/MetaConnectionPicker.tsx',deps).default;
for(const [state,verified,lastError,tone] of [['CONNECTED',true,'','success'],['CONNECTED_DIRECT_PUBLISHING_DISABLED',true,'','success'],['CONNECTED',false,'','neutral'],['DISCONNECTED',true,'','neutral'],['EXPIRING',true,'','warning'],['CONNECTED',true,'Test failed','error']]) {
 const connection={id:'fixture',platform:'FACEBOOK',state,intendedAccountName:'Fixture',providerUsername:'',providerAccountId:'fixture',directPublishingEnabled:false,manualPublishingUrl:'',lastVerifiedAt:verified?'2026-11-17T00:00:00Z':'',lastPublishedAt:'',lastError};
 const html=renderToStaticMarkup(React.createElement(MetaPicker,{destinations:[],selected:[],connections:[connection],busy:false}));
 assert.ok(html.includes(`admin-status-badge admin-status-${tone}`));if(state.startsWith('CONNECTED'))assert.ok(html.includes('Enable publishing'));
}
const Header=load('app/admin/components/AdminPageLayout.tsx').AdminPageHeader;
const header=renderToStaticMarkup(React.createElement(Header,{eyebrow:'Identity',title:'Settings',description:'Description',note:'Note',actions:React.createElement('button',{type:'button'},'Save')}));
assert.equal((header.match(/<h1\b/g)||[]).length,1);for(const text of ['Identity','Settings','Description','Note','Save'])assert.ok(header.includes(text));
for(const route of ['settings','about','ctas','client-portals','photo-comparison','video-offerings','homepage']) {const page=read(`app/admin/${route}/page.tsx`);assert.match(page,/<AdminPageHeader eyebrow=/);assert.doesNotMatch(page,/<h1\b/);}
const Message=load('app/admin/components/AdminStatusMessage.tsx').default;
for(const tone of ['neutral','success','error']) {const html=renderToStaticMarkup(React.createElement(Message,{tone},'Result'));assert.ok(html.includes(`role="${tone==='error'?'alert':'status'}"`));assert.ok(html.includes(`admin-status-${tone}`));assert.match(html,/aria-atomic="true"/);}
for(const outcome of ['success','rejected','network']) {
 let slot=0;const values=[],requests=[];
 const data={nextEdition:{id:'fixture-edition',warnings:[]},editions:[],series:[],groups:[]};
 const reactStub={...React,useEffect(){},useState(initial){const i=slot++;values[i]=i===0?data:initial;return [values[i],v=>{values[i]=v;}];}};
 const compiledModule={exports:{}};
 const output=ts.transpileModule(read('app/admin/newsletter-studio/components/NewsletterDashboard.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 vm.runInNewContext(output,{exports:compiledModule.exports,module:compiledModule,Intl,Error,fetch:async(url,options)=>{requests.push({url,body:JSON.parse(options.body)});if(outcome==='network')throw new Error('Offline');return {ok:outcome==='success',json:async()=>({success:outcome==='success',message:'Draft prepared',error:'Request rejected'})};},require:name=>name==='react'?reactStub:name==='react/jsx-runtime'?require(name):name==='./dashboard-state'?{updateSeriesActive:x=>x}:{default:()=>null,AdminPageHeader:()=>null}});
 const tree=compiledModule.exports.default({summary:null});await tree.props.header.props.actions.props.children[1].props.onClick();
 assert.equal(requests.length,1);assert.equal(requests[0].url,'/api/admin/newsletters');assert.equal(requests[0].body.action,'generate');assert.equal(requests[0].body.editionId,'fixture-edition');assert.equal(values[4],outcome==='success'?'success':'error');assert.equal(values[2],outcome==='success'?'Draft prepared':outcome==='rejected'?'Request rejected':'Offline');
}
const css=read('app/globals.css');
const output=await postcss([tailwind()]).process(css,{from:'app/globals.css'});
for(const selector of ['.admin-btn-success','details[open] > .admin-disclosure-summary','.admin-disclosure-summary:focus-visible'])assert.ok(output.css.includes(selector));
assert.match(css,/:is\(\.admin-btn-icon, \.admin-btn-icon-sm\):hover:not\(:disabled\)/);assert.match(css,/:is\(\.admin-btn-icon, \.admin-btn-icon-sm\):active:not\(:disabled\)/);
assert.match(css,/\.admin-form-scope\[data-studio-appearance\] \.admin-btn-primary:hover:not\(:disabled\)/);
assert.match(css.match(/\.admin-btn-primary:hover\s*\{([^}]+)\}/)[1],/background: rgba\(217, 107, 43, 0.12\)/);
function luminance(hex){return hex.match(/\w\w/g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
for(const [ink,fill] of [['166534','f0f8f2'],['166534','e3f2e7'],['a7f3d0','142820'],['a7f3d0','1b382b'],['b42318','fff3f2'],['fecaca','321c1e'],['854d0e','fffbea'],['fde68a','292619']]){const [hi,lo]=[luminance(ink),luminance(fill)].sort((a,b)=>b-a);assert.ok((hi+.05)/(lo+.05)>=4.5);}
assert.doesNotMatch(read('app/admin/feedback/FeedbackWorkspace.tsx'),/styles\.(primary|button|error|success)\b/);
assert.doesNotMatch(read('app/admin/feedback/FeedbackWorkspace.module.css'),/#ed6833; border-color|radial-gradient/);
for(const file of ['EventStudio','EventDraftPreview','EventAppearance','EventAIWriter','EventUpdateComposer'])assert.match(read(`app/admin/events/${file}.tsx`),/const button = "admin-btn-secondary"/);
assert.match(read('app/admin/events/EventDraftPreview.tsx'),/className=\{`\$\{button\} admin-choice`\}/);
console.log('PASS: real AdminButton SSR; badges/disclosures/messages/header SSR; Newsletter action outcomes; CSS compilation/contrast; adoption and scoped interaction contracts.');
console.log('LIMIT: not real-browser computed-style or populated-route visual sign-off.');
