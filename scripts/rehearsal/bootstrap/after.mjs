import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {databaseUrl} from '../../migrations/bootstrap/artifact.mjs';
import {inspect,readLedger} from '../../migrations/bootstrap/inspect.mjs';
assert.equal(process.env.PACKET11_REHEARSAL,'isolated-only');
const db=new pg.Client({connectionString:databaseUrl('helios_packet9')});await db.connect();
try{assert.equal(JSON.stringify(await readLedger(db)),await readFile('.packet11-ledger-before.json','utf8'));assert.equal((await inspect(db,JSON.parse(await readFile('.packet11-reference.json','utf8')))).state,'current-compatible-ledger');console.log('PASS real application use left migration ledger and schema unchanged');}finally{await db.end();}
