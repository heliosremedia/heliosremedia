import assert from 'node:assert/strict';
import test from 'node:test';
import {databaseUrl,requireDatabase,digest} from '../scripts/rehearsal/restoration/core.mjs';
test('restoration harness refuses arbitrary databases and production-like endpoints',()=>{
 assert.equal(requireDatabase(databaseUrl('packet10_source')),databaseUrl('packet10_source'));
 for(const name of ['production','postgres','packet10_source;DROP DATABASE postgres'])assert.throws(()=>databaseUrl(name));
 for(const url of [undefined,'postgresql://production/helios',databaseUrl('packet10_source')+'?schema=public',databaseUrl('packet10_source').replace('55439','5432')])assert.throws(()=>requireDatabase(url));
});
test('integrity checksum detects changed owner, revision, ordering and publication data',()=>{
 const baseline={id:'a',workspaceId:'a',revision:'old',order:1,published:true};
 for(const change of [{workspaceId:'b'},{revision:'new'},{order:2},{published:false}])assert.notEqual(digest(baseline),digest({...baseline,...change}));
 assert.equal(digest(baseline),digest({...baseline}));
});

 test('virtual-host rehearsal sends the requested Host to the loopback application',async()=>{
 const {createServer}=await import('node:http');const {readHost}=await import('../scripts/rehearsal/restoration/http.mjs');
 const server=createServer((req,res)=>res.end(req.headers.host));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const address=server.address();assert.ok(address&&typeof address!=='string');const origin='http://127.0.0.1:'+address.port;assert.deepEqual(await readHost(origin,'localhost'),{status:200,text:'localhost'});assert.deepEqual(await readHost(origin,'127.0.0.1'),{status:200,text:'127.0.0.1'});assert.throws(()=>readHost('https://production.example','localhost'));}finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
