import { strict as assert } from "node:assert";
import { test } from "node:test";
import { hdphId, hdphProperty, hdphEligiblePhoto, hdphPhotoUrl, hdphSafeImageUrl, hdphSearchPage, hdphSearchPath } from "./project-hdph-import.ts";

test("IDs are strictly validated", () => { for (const value of [null,"",0,-1,"1/2","1e3","1?x=y",Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => hdphId(value)); assert.equal(hdphId("123"),123); });
test("property mapping cannot leak notes or contacts", () => { assert.deepEqual(hdphProperty({location:{address:"12 A",city:"Town",region:"CO"},notes:"secret",clientEmail:"private",description:"source copy"}),{title:"12 A",city:"Town",state:"CO",locationLabel:"Town, CO",propertyAddress:"12 A, Town, CO"}); });
test("only visible unrestricted photos qualify", () => { const base={type:"photo",status:"visible"}; assert.ok(hdphEligiblePhoto(base)); for(const extra of [{type:"video"},{status:"hidden"},{status:"deleted"},{archived:"complete"},{canDownload:false},{branded:false}]) assert.equal(hdphEligiblePhoto({...base,...extra}),false); });
test("choose ready bounded rendition, never arbitrary original", () => { assert.equal(hdphPhotoUrl({type:"photo",status:"visible",images:[{url:"large",width:6000},{url:"web",width:3000},{url:"small",width:1000}]}),"web"); assert.throws(() => hdphPhotoUrl({type:"photo",status:"visible",original:{url:"raw"}})); });
test("download host policy rejects SSRF and credential URLs", () => { for(const url of ["http://cdn.hd.pics/x","https://127.0.0.1/x","https://hd.pics.evil.com/x","https://u:p@cdn.hd.pics/x","https://cdn.hd.pics:444/x","file:///x"]) assert.throws(() => hdphSafeImageUrl(url)); assert.equal(hdphSafeImageUrl("https://cdn.hd.pics/x"),"https://cdn.hd.pics/x"); });


test("search distinguishes malformed provider response from genuinely empty results", () => {
  assert.throws(() => hdphSearchPage({items:[]}, 2, 0), /unexpected search response/);
  assert.deepEqual(hdphSearchPage({data:[]},2,0).sites, []);
});
test("search preserves legitimate page results and enforces brand boundaries", () => {
  const row = {siteId:12,brandId:2,bought:"2026-11-03",status:"active",location:{address:"1597 Folsum Dr",city:"Windsor",region:"CO"}};
  const page = hdphSearchPage({data:[row,{...row,siteId:13,brandId:3}],nextPage:25},2,0);
  assert.equal(page.sites.length,1); assert.equal(page.sites[0].title,"1597 Folsum Dr"); assert.equal(page.nextOffset,25);
  assert.equal(page.diagnostics.returned,2); assert.equal(page.diagnostics.sameBrand,1);
  assert.throws(() => hdphSearchPage({data:[],nextPage:0},2,0), /invalid search continuation/);
});


test("partial-address discovery does not silently hide payment-protected properties", () => {
  for (const term of ["5581", "5581 Carmon"]) {
    const url = new URL(hdphSearchPath(term, 25), "https://api.hd.pics");
    assert.equal(url.searchParams.get("address"), term);
    assert.equal(url.searchParams.has("missingKey"), false);
    assert.deepEqual(url.searchParams.getAll("deliveryLevel"), ["basic", "full"]);
    assert.equal(url.searchParams.get("offset"), "25");
  }
});


test("site payment configuration is not a per-photo permission; explicit download denial remains denied", () => {
  assert.equal(hdphEligiblePhoto({type:"photo",status:"visible",canDownload:true}), true);
  assert.equal(hdphEligiblePhoto({type:"photo",status:"visible",canDownload:false}), false);
});
