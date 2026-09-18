import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

/** Read-only candidate-tree check. Passing this narrow check never authorizes a deployment. */
export function checkHomepageRollback(root, manifest=JSON.parse(readFileSync(new URL('./homepage-writer-bundle.json',import.meta.url),'utf8'))){
 const errors=[];
 for(const {path,sha256} of manifest.files){
  try{const actual=createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex');if(actual!==sha256)errors.push(path);}
  catch{errors.push(path);}
 }
 return {safe:errors.length===0,changedOrMissing:errors};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=checkHomepageRollback(process.argv[2]||process.cwd());
 if(!result.safe){console.error('STOP: rollback candidate lacks the reviewed homepage mutation bundle:',result.changedOrMissing.join(', '));process.exitCode=1;}
 else console.log('PASS: homepage mutation bundle retained. Hosted routing, config, database and other release gates remain separate. No deployment performed.');
}
