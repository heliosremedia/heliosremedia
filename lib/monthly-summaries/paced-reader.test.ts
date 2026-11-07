import test from 'node:test';
import assert from 'node:assert/strict';
import {createPacedReader, RateLimitError} from './paced-reader.ts';
test('requests are serialized and spaced even when callers overlap',async()=>{
 let clock=0;const times:number[]=[];
 const read=createPacedReader({now:()=>clock,wait:async ms=>{clock+=ms;},fetcher:(async()=>{times.push(clock);return Response.json({});}) as typeof fetch});
 await Promise.all([read('https://example.test'),read('https://example.test'),read('https://example.test')]);assert.deepEqual(times,[0,1500,3000]);
});
test('429 respects provider Retry-After and retries read-only requests',async()=>{
 let clock=0,count=0;const read=createPacedReader({now:()=>clock,wait:async ms=>{clock+=ms;},fetcher:(async()=>++count===1?new Response('',{status:429,headers:{'retry-after':'75'}}):Response.json({})) as typeof fetch});
 assert.equal((await read('https://example.test')).status,200);assert.equal(clock,75000);assert.equal(count,2);
});
test('rate limit exceeding batch deadline stops instead of producing failed-account records',async()=>{
 let clock=0;const read=createPacedReader({now:()=>clock,wait:async ms=>{clock+=ms;},deadline:30000,fetcher:(async()=>new Response('',{status:429})) as typeof fetch});
 await assert.rejects(read('https://example.test'),RateLimitError);
});
