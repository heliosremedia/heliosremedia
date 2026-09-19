import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {head,isolatedEnvironment} from './gate.mjs';
import {canonical} from './policy.mjs';
isolatedEnvironment();const candidate=head();assert.equal(candidate,process.env.GITHUB_SHA||candidate);
const result=await new Promise((resolve,reject)=>{
 const p=spawn('npm',['test'],{env:{PATH:process.env.PATH,HOME:process.env.HOME,DIRECT_URL:'postgresql://unused:unused@127.0.0.1:1/unused',DATABASE_URL:'postgresql://unused:unused@127.0.0.1:1/unused'},stdio:['ignore','pipe','pipe']});let output='';p.stdout.on('data',b=>{output+=b;process.stdout.write(b);});p.stderr.on('data',b=>process.stderr.write(b));p.on('error',reject);p.on('exit',code=>resolve({code,output}));
});
assert.equal(result.code,0,'Regression failed');const count=[...result.output.matchAll(/(?:# |ℹ )tests (\d+)/g)].at(-1);const failed=[...result.output.matchAll(/(?:# |ℹ )fail (\d+)/g)].at(-1);assert.ok(count&&failed,'Missing test totals');assert.equal(Number(failed[1]),0);
await mkdir('release-evidence',{recursive:true});await writeFile('release-evidence/tests.json',canonical({candidate,status:'passed',count:Number(count[1]),failed:0,suite:'repository-node-regression'})+'\n');
