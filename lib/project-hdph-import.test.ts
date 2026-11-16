import { strict as assert } from "node:assert";
import { test } from "node:test";
import { hdphId, hdphProperty, hdphEligiblePhoto, hdphPhotoUrl, hdphSafeImageUrl } from "./project-hdph-import.ts";

test("IDs are strictly validated", () => { for (const value of [null,"",0,-1,"1/2","1e3","1?x=y",Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => hdphId(value)); assert.equal(hdphId("123"),123); });
test("property mapping cannot leak notes or contacts", () => { assert.deepEqual(hdphProperty({location:{address:"12 A",city:"Town",region:"CO"},notes:"secret",clientEmail:"private",description:"source copy"}),{title:"12 A",city:"Town",state:"CO",locationLabel:"Town, CO",propertyAddress:"12 A, Town, CO"}); });
test("only visible unrestricted photos qualify", () => { const base={type:"photo",status:"visible"}; assert.ok(hdphEligiblePhoto(base)); for(const extra of [{type:"video"},{status:"hidden"},{status:"deleted"},{archived:"complete"},{canDownload:false},{branded:false}]) assert.equal(hdphEligiblePhoto({...base,...extra}),false); });
test("choose ready bounded rendition, never arbitrary original", () => { assert.equal(hdphPhotoUrl({type:"photo",status:"visible",images:[{url:"large",width:6000},{url:"web",width:3000},{url:"small",width:1000}]}),"web"); assert.throws(() => hdphPhotoUrl({type:"photo",status:"visible",original:{url:"raw"}})); });
test("download host policy rejects SSRF and credential URLs", () => { for(const url of ["http://cdn.hd.pics/x","https://127.0.0.1/x","https://hd.pics.evil.com/x","https://u:p@cdn.hd.pics/x","https://cdn.hd.pics:444/x","file:///x"]) assert.throws(() => hdphSafeImageUrl(url)); assert.equal(hdphSafeImageUrl("https://cdn.hd.pics/x"),"https://cdn.hd.pics/x"); });
