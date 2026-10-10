import assert from 'node:assert/strict';
import {check} from './diagnostics.mjs';
// Only fixed categories survive request interception. Never retain URLs or headers.
export function egressCategories(url,resourceType){
 const host=new URL(url).hostname;
 const destination=host==='vercel.live'?'HTTP_EGRESS_VERCEL_LIVE'
  :host==='vercel.com'||host.endsWith('.vercel.com')?'HTTP_EGRESS_VERCEL_COM'
  :/^packet16-[ab]\.example\.test$/.test(host)?'HTTP_EGRESS_FIXTURE_HOST'
  :host==='heliosrealestatemedia.com'||host==='www.heliosrealestatemedia.com'?'HTTP_EGRESS_HELIOS_HOST'
  :host.endsWith('.vercel.app')?'HTTP_EGRESS_OTHER_PREVIEW'
  :'HTTP_EGRESS_OTHER_HOST';
 const types={image:'HTTP_EGRESS_IMAGE',script:'HTTP_EGRESS_SCRIPT',stylesheet:'HTTP_EGRESS_STYLESHEET',font:'HTTP_EGRESS_FONT',media:'HTTP_EGRESS_MEDIA',document:'HTTP_EGRESS_DOCUMENT',fetch:'HTTP_EGRESS_FETCH',xhr:'HTTP_EGRESS_XHR'};
 return [destination,Object.hasOwn(types,resourceType)?types[resourceType]:'HTTP_EGRESS_OTHER_TYPE'];
}
export function assertNoEgress(blocked){
 // Same assertion, count, message and error object; diagnostics add no acceptance path.
 let operation=()=>check('HTTP_BROWSER_EGRESS',()=>assert.equal(blocked.length,0,'Unexpected browser egress blocked'));
 for(const code of [...new Set(blocked.flat())].sort()){const inner=operation;operation=()=>check(code,inner);}
 operation();
}
