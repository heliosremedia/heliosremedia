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
const source=fs.readFileSync('app/admin/components/StudioAppearance.tsx','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const compiledModule={exports:{}};
vm.runInNewContext(compiled,{exports:compiledModule.exports,require,module:compiledModule});
const {normalizeAppearance,appearanceBootstrap,default:Control,StudioAppearanceContext}=compiledModule.exports;
for(const [input,expected] of [['day','day'],['night','night'],['system','system'],['invalid','system'],['constructor','system'],['toString','system'],['__proto__','system'],[null,'system']]){
 assert.equal(normalizeAppearance(input),expected);
 const parentElement={dataset:{}};
 vm.runInNewContext(appearanceBootstrap,{document:{currentScript:{parentElement}},localStorage:{getItem:()=>input}});
 assert.equal(parentElement.dataset.studioAppearance,expected);
}
const parentElement={dataset:{studioAppearance:'system'}};
vm.runInNewContext(appearanceBootstrap,{document:{currentScript:{parentElement}},localStorage:{getItem:()=>{throw Error('blocked')}}});
assert.equal(parentElement.dataset.studioAppearance,'system');
for(const value of ['day','night','system']){
 const html=renderToStaticMarkup(React.createElement(StudioAppearanceContext.Provider,{value},React.createElement(Control)));
 assert.equal((html.match(/<button/g)||[]).length,1);
 assert.match(html,/aria-haspopup="menu"/);
 assert.match(html,/aria-expanded="false"/);
 assert.ok(html.includes(`aria-label="Appearance: ${value[0].toUpperCase()+value.slice(1)}"`));
 assert.ok(!html.includes('role="menuitemradio"'));
}
const css=fs.readFileSync('app/admin/studio-appearance.css','utf8');
assert.match(css,/focus-visible/);assert.match(css,/min-height: 44px/);
const legacy=fs.readFileSync('app/admin/studio-legacy-theme.css','utf8');
assert.match(legacy,/prefers-color-scheme: light/);assert.match(legacy,/data-studio-fixed-colors/);
const output=await postcss([tailwind()]).process(css,{from:'app/admin/studio-appearance.css'});
assert.ok(output.css.includes('data-studio-appearance'));
console.log('PASS: preference validation, pre-content bootstrap, blocked storage fallback, compact accessible menu trigger and current preference, focus/touch target contracts, scoped CSS compile.');
console.log('NOTE: does not replace real-browser hydration, persistence, contrast, or cross-module visual QA.');
