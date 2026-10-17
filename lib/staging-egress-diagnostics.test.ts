import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {egressCategories,assertNoEgress} from '../scripts/staging/actions/egress.mjs';
import {diagnostic} from '../scripts/staging/actions/diagnostics.mjs';

test('egress destinations and resource types produce only fixed categories',()=>{
 const hosts:Record<string,string>={'vercel.live':'VERCEL_LIVE','vercel.com':'VERCEL_COM','assets.vercel.com':'VERCEL_COM','packet16-a.example.test':'FIXTURE_HOST','packet16-b.example.test':'FIXTURE_HOST','heliosrealestatemedia.com':'HELIOS_HOST','www.heliosrealestatemedia.com':'HELIOS_HOST','other.vercel.app':'OTHER_PREVIEW','vercel.live.attacker.test':'OTHER_HOST','notvercel.com':'OTHER_HOST','private.invalid':'OTHER_HOST'};
 const types:Record<string,string>={image:'IMAGE',script:'SCRIPT',stylesheet:'STYLESHEET',font:'FONT',media:'MEDIA',document:'DOCUMENT',fetch:'FETCH',xhr:'XHR',websocket:'OTHER_TYPE',constructor:'OTHER_TYPE',toString:'OTHER_TYPE'};
 for(const [host,destination]of Object.entries(hosts))for(const [type,resource]of Object.entries(types))assert.deepEqual(egressCategories(`https://${host}/secret-path?token=secret-sentinel`,type),['HTTP_EGRESS_'+destination,'HTTP_EGRESS_'+resource]);
});
test('egress diagnostics retain rejection count and hash without retaining request details',()=>{
 const blocked=[egressCategories('https://private.invalid/secret?token=sentinel','image'),egressCategories('https://private.invalid/other','image')];
 let original:Error|undefined;try{assert.equal(2,0,'Unexpected browser egress blocked');}catch(error){original=error as Error;}
 assert.throws(()=>assertNoEgress(blocked),(error:unknown)=>{
  assert.ok(error instanceof assert.AssertionError);assert.equal(error.actual,2);assert.equal(error.expected,0);assert.equal(error.message,original!.message);
  const result=diagnostic('hosted-http-chromium',error);
  assert.equal(result.reason,'CHECK_HTTP_EGRESS_OTHER_HOST__HTTP_EGRESS_IMAGE__HTTP_BROWSER_EGRESS');
  assert.equal(result.detailHash,createHash('sha256').update(original!.message).digest('hex'));
  assert.doesNotMatch(JSON.stringify({blocked,result}),/private|secret|sentinel|https/);return true;
 });
});
test('zero egress passes and mixed categories remain deterministic and deduplicated',()=>{
 assert.doesNotThrow(()=>assertNoEgress([]));
 const blocked=[egressCategories('https://vercel.live/','script'),egressCategories('https://packet16-a.example.test/','image')];
 const reason=(rows:string[][])=>{try{assertNoEgress(rows);}catch(error){return String(diagnostic('hosted-http-chromium',error).reason);}assert.fail('Must reject');};
 assert.equal(reason(blocked),reason([...blocked].reverse()));
 assert.equal(reason(blocked),reason([...blocked,...blocked]));
 assert.match(reason(blocked),/HTTP_EGRESS_FIXTURE_HOST/);assert.match(reason(blocked),/HTTP_EGRESS_VERCEL_LIVE/);
});
test('untrusted category labels cannot enter diagnostics',()=>{
 assert.throws(()=>assertNoEgress([['private-secret-sentinel']]),/UNKNOWN_DIAGNOSTIC_CHECK/);
});
