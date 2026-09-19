// Read-only diagnostic for the fixed disposable rehearsal databases.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {databaseUrl} from './artifact.mjs';
import {inspect} from './inspect.mjs';
const [name,referenceFile]=process.argv.slice(2);assert.ok(name&&referenceFile,'Usage: diagnose.mjs packet11_clean <verified-reference.json>');
const reference=JSON.parse(await readFile(referenceFile,'utf8'));
assert.deepEqual(reference.manifest,JSON.parse(await readFile('scripts/migrations/bootstrap/history-sha256.json','utf8')),'Reference must use reviewed immutable history');
const db=new pg.Client({connectionString:databaseUrl(name)});await db.connect();
try{const report=await inspect(db,reference);console.log(JSON.stringify(report,null,2));if(!report.mayDeploy)process.exitCode=2;}finally{await db.end();}
