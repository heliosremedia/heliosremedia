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
