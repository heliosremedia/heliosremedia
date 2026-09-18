import assert from 'node:assert/strict';
import test from 'node:test';
import {DATABASE,requireIsolatedDatabase,requireLoopback} from '../scripts/rehearsal/application/safety.mjs';
test('application rehearsal refuses every database except its exact disposable fixture',()=>{
 assert.equal(requireIsolatedDatabase(DATABASE),DATABASE);
 for(const value of [undefined,'postgresql://production.example/helios',DATABASE+'?schema=public',DATABASE.replace('55439','5432')])assert.throws(()=>requireIsolatedDatabase(value));
});
test('application routing rehearsal cannot target remote, credentialed or path-injected origins',()=>{
 assert.equal(requireLoopback('http://127.0.0.1:4501'),'http://127.0.0.1:4501');
 for(const value of ['https://helios.example','http://localhost:4501','http://127.0.0.1:4501/path','http://user@127.0.0.1:4501','http://127.0.0.1:4501?remote=production'])assert.throws(()=>requireLoopback(value));
});
