import { VerificationError } from "./v1-check.ts";
export class RateLimitError extends VerificationError { name = "RateLimitError"; }
export function createPacedReader(input: { fetcher?: typeof fetch; wait?: (ms:number)=>Promise<void>; now?:()=>number; deadline?:number } = {}): typeof fetch {
  const fetcher=input.fetcher || fetch, wait=input.wait || (ms=>new Promise(r=>setTimeout(r,ms))), now=input.now || Date.now;
  let queue=Promise.resolve(), nextAt=0;
  return (async (url, init) => {
    let release!:()=>void;
    const prior=queue;queue=new Promise<void>(r=>{release=r;});
    await prior;
    try {
      for(let attempt=0;attempt<3;attempt++) {
        const delay=Math.max(0,nextAt-now());
        if(input.deadline && now()+delay+15_000>input.deadline)throw new RateLimitError("API pacing exceeded this batch's time limit. Resume generation shortly.");
        if(delay)await wait(delay);
        const response=await fetcher(url,{...init,signal:AbortSignal.timeout(15_000)});
        nextAt=now()+1500;
        if(response.status!==429)return response;
        const retry=response.headers.get('retry-after');
        const numeric=retry===null?NaN:Number(retry);
        const ms=Number.isFinite(numeric)?numeric*1000:retry?Date.parse(retry)-now():60_000;
        nextAt=now()+Math.max(60_000,Number.isFinite(ms)?ms:60_000);
        if(attempt===2)throw new RateLimitError("HDPhotoHub rate limit persists. Saved batches are retained; resume generation later.");
      }
      throw new RateLimitError("HDPhotoHub rate limit persists.");
    } finally {release();}
  }) as typeof fetch;
}
