import {build} from 'esbuild';
import {resolve} from 'node:path';
export async function bundle(){
 const context=resolve('scripts/staging/tenant/context.ts');
 await build({entryPoints:['scripts/staging/tenant/driver.ts'],outfile:'.packet16-tenant-driver.mjs',bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'isolated-request-adapter',setup(b){
  b.onResolve({filter:/^(@\/lib\/prisma|next\/headers|next\/cache|next\/navigation)$/},()=>({path:context}));
  b.onResolve({filter:/^next\/server$/},()=>({path:'next/server.js',external:true}));
  b.onResolve({filter:/^server-only$/},()=>({path:'empty',namespace:'fixture'}));
  b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export {};'}));
 }}]});
}
