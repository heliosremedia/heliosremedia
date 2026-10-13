import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {verifiedCurrentMigrationSource} from './current-upgrade-source.mjs';

test('actual live/rehearsal source verifier admits the exact checked-in UTF-8 bytes',async()=>{
 const source=await verifiedCurrentMigrationSource();
 assert.equal(Object.keys(source.extensions).length,6);
 assert.ok(Object.keys(source.history).length>19);
});
for(const mode of ['migration-bytes','extra-migration','history-manifest','extension-manifest']){
 test('shared source verifier rejects '+mode+' before migration execution',async()=>{
  const root=await mkdtemp(join(tmpdir(),'studio-source-test-'));
  try{
   await mkdir(join(root,'prisma'),{recursive:true});
   await cp('prisma/migrations',join(root,'prisma/migrations'),{recursive:true});
   for(const dir of ['scripts/migrations/bootstrap','scripts/rehearsal/staging-upgrade'])await mkdir(join(root,dir),{recursive:true});
   await cp('scripts/migrations/bootstrap/history-sha256.json',join(root,'scripts/migrations/bootstrap/history-sha256.json'));
   await cp('scripts/rehearsal/staging-upgrade/migrations.json',join(root,'scripts/rehearsal/staging-upgrade/migrations.json'));
   const source=await verifiedCurrentMigrationSource(root);
   if(mode==='migration-bytes'){
    const path=join(root,'prisma/migrations',Object.keys(source.extensions)[0],'migration.sql');
    await writeFile(path,(await readFile(path,'utf8'))+'\n-- unexpected drift\n');
   }else if(mode==='extra-migration')await mkdir(join(root,'prisma/migrations/20990101000000_unreviewed'));
   else{
    const path=join(root,mode==='history-manifest'?'scripts/migrations/bootstrap/history-sha256.json':'scripts/rehearsal/staging-upgrade/migrations.json');
    await writeFile(path,'{}\n');
   }
   await assert.rejects(verifiedCurrentMigrationSource(root));
  }finally{await rm(root,{recursive:true,force:true});}
 });
}
