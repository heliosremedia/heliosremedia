// The live runner and disposable rehearsal use the same immutable file checks.
// Read as UTF-8: inspect.hash serializes non-string values and is not a Buffer digest.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {hash} from '../migrations/bootstrap/inspect.mjs';
import {REVIEWED_CURRENT_MIGRATIONS} from './current-upgrade-policy.mjs';
export async function verifiedCurrentMigrationSource(root=process.cwd()){
 const raw=await readFile(join(root,'scripts/migrations/bootstrap/history-sha256.json'),'utf8');
 assert.equal(hash(raw),'8cb9e5d72af3c2353018a3099d14172794e165a5e54ee11b02e80c46a5e6437a');
 const history=JSON.parse(raw);
 const extensions=JSON.parse(await readFile(join(root,'scripts/rehearsal/staging-upgrade/migrations.json'),'utf8'));
 assert.deepEqual(extensions,REVIEWED_CURRENT_MIGRATIONS,'Only reviewed migration bytes may execute');
 assert.deepEqual((await readdir(join(root,'prisma/migrations'))).filter(n=>/^\d/.test(n)).sort(),[...Object.keys(history),...Object.keys(extensions)].sort());
 for(const [name,checksum] of Object.entries({...history,...extensions}))
  assert.equal(hash(await readFile(join(root,'prisma/migrations',name,'migration.sql'),'utf8')),checksum,'Immutable migration checksum');
 return {history,extensions};
}
