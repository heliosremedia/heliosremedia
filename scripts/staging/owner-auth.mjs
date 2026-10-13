// Runner-only adapter to the application's actual password implementation.
// server-only is omitted here solely because this is a Node CLI, never a route.
import {build} from 'esbuild';
export async function ownerAuth(){
 const result=await build({entryPoints:['lib/auth/password.ts'],bundle:true,write:false,platform:'node',format:'esm',packages:'external',plugins:[{name:'cli-server-only',setup(b){
  b.onResolve({filter:/^server-only$/},()=>({path:'empty',namespace:'cli'}));
  b.onLoad({filter:/.*/,namespace:'cli'},()=>({contents:'export {};'}));
 }}]});
 return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
