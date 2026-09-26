// Native Next output includes dependency links; hash their bytes without trusting escapes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat,readdir,readFile,realpath} from 'node:fs/promises';
import {resolve,join,relative,sep} from 'node:path';
export async function hostedDigest(root='.next',dependencies='node_modules'){
 const base=await realpath(root),deps=await realpath(dependencies),h=createHash('sha256');let count=0;
 const inside=(p,r)=>p===r||p.startsWith(r+sep);
 async function walk(path,rel,ancestors){
  if(rel==='cache'||rel.startsWith('cache/'))return;
  const stat=await lstat(path);let target=path;
  if(stat.isSymbolicLink()){
   assert.ok(rel.startsWith('node_modules/'),'Unexpected output symlink');
   target=await realpath(path);assert.ok(inside(target,deps),'Dependency link escapes reviewed dependencies');
  }
  const current=await lstat(target);
  if(current.isDirectory()){
   const canonical=await realpath(target);assert.ok(!ancestors.has(canonical),'Dependency cycle');
   const next=new Set(ancestors).add(canonical);
   for(const name of (await readdir(target)).sort())await walk(join(target,name),rel?rel+'/'+name:name,next);
  }else{
   assert.ok(current.isFile(),'Unsupported output object');const bytes=await readFile(target);
   h.update(rel+'\0'+bytes.length+'\0');h.update(bytes);count++;
  }
 }
 assert.equal(relative(resolve(root),base),'','Build root must not be a symlink');
 await walk(base,'',new Set());assert.ok(count>0);return h.digest('hex');
}
