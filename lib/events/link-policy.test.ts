import test from "node:test";
import assert from "node:assert/strict";
import { verifiedEventLink } from "./link-policy.ts";
import { getCanonicalSiteUrl } from "../site.ts";
const token="A".repeat(43),canonical="https://www.heliosrealestatemedia.com";
test("verified Helios aliases normalize to canonical without changing either event credential",()=>{
 for(const path of ["/events/invite","/events/rsvp"] as const)for(const origin of [canonical,"https://heliosrealestatemedia.com","https://www.heliosremedia.com","https://heliosremedia.com"]){
  assert.equal(verifiedEventLink(`${origin}${path}#token=${token}`,path,"https://preview.example.test").href,`${canonical}${path}#token=${token}`);
 }
 assert.equal(verifiedEventLink(`/events/invite#token=${token}`,"/events/invite","https://preview.example.test").origin,"https://preview.example.test");
});
test("foreign hosts, credentials, wrong paths, query tokens and malformed fragments remain rejected",()=>{
 const suffix=`/events/invite#token=${token}`;
 for(const value of [null,{},`https://evil.example${suffix}`,`https://heliosrealestatemedia.com.evil.example${suffix}`,`http://heliosrealestatemedia.com${suffix}`,`https://user:pass@www.heliosrealestatemedia.com${suffix}`,`https://www.heliosrealestatemedia.com:444${suffix}`,`${canonical}/events/rsvp#token=${token}`,`${canonical}/events/invite?token=${token}`,`${canonical}${suffix}&response=YES`,`${canonical}/events/invite#token=short`])assert.throws(()=>verifiedEventLink(value,"/events/invite",canonical));
});
test("event URL generation uses canonical public origin even when deployment base is an alias or preview",()=>{
 const previous=process.env.NEXT_PUBLIC_SITE_URL;
 try {for(const origin of ["https://heliosremedia.com","https://preview.vercel.app","http://localhost:3000"]){process.env.NEXT_PUBLIC_SITE_URL=origin;assert.equal(getCanonicalSiteUrl(),canonical);}}
 finally {if(previous===undefined)delete process.env.NEXT_PUBLIC_SITE_URL;else process.env.NEXT_PUBLIC_SITE_URL=previous;}
});
