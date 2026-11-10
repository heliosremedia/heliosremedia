/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as themes from "./themes.ts";
import * as personalization from "./personalization.ts";
import * as emailFormat from "../client-communications/email-format.ts";

const mediaBase = "https://media.example.com/assets";
const imageUrl = `${mediaBase}/events/workspace/12345678-1234-1234-1234-123456789abc.png`;
function load(file: string, mocks: Record<string, unknown>) {
  const js = ts.transpileModule(readFileSync(new URL(file,import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(js,{exports,require:(name:string)=>{if(!(name in mocks)) throw new Error(`Unexpected import (including writes/send): ${name}`); return mocks[name];},process:{env:{R2_PUBLIC_URL:mediaBase}},Date,URL,Buffer,console,TextDecoder,Error},{filename:file});
  return exports;
}
const preview = load("./preview.ts",{"server-only":{},"./themes":themes});
const site = {getSiteUrl:()=>"https://studio.example.com"};
const campaign = load("../client-communications/email.ts",{"server-only":{},"@/lib/site":site,"@/lib/newsletters/presentation":{testEmailSubject:(s:string)=>s},"./providers/resend":new Proxy({}, {get:()=>{throw new Error("Email sending is forbidden");}}),"./email-format":emailFormat});
const email = load("./email.ts",{"server-only":{},"@/lib/site":site,"@/lib/client-communications/email":campaign,"./themes":themes,"./personalization":personalization});
const next = {NextResponse:{json:(data:unknown,options?:any)=>({data,status:options?.status || 200,headers:options?.headers})}};
const api = load("./api.ts",{"next/server":next});
let imageQueries: any[] = [];
const service = load("./service.ts",{"server-only":{},"@/lib/client-communications/bounce-core":{},"@/lib/prisma":{prisma:{media:{findFirst:async(query:any)=>{imageQueries.push(query);return null;}}}},"@/lib/auth/session":{},"@/lib/client-communications/preferences":{},"@/lib/audit":{},"./themes":themes,"./core":{}});
function route(admin = async()=>({workspaceId:"workspace"})) {
  return load("../../app/api/admin/events/preview/route.ts",{"next/server":next,"@/lib/events/service":{eventAdmin:admin,validateEventImageSelection:service.validateEventImageSelection},"@/lib/events/api":api,"@/lib/events/preview":preview,"@/lib/events/email":email});
}
const request = (data:unknown)=>new Request("https://studio.example.com/api/admin/events/preview",{method:"POST",body:JSON.stringify(data)});
const base = {title:"Current <event>",description:"New description & details",location:"Current studio",startsAt:"2031-06-15T18:30:00.000Z",timeZone:"America/Denver",imageUrl,imageAlt:"Current photo",venueUrl:"https://venue.example.com"};

test("draft preview renders actual email for all eight styles and all stages without sending or writing",async()=>{
  const handler = route();
  for (const templateKey of themes.EVENT_TEMPLATE_KEYS) for (const stage of ["INITIAL","FOLLOW_UP","REMINDER"]) {
    const result = await handler.POST(request({...base,templateKey,stage,emailContent:{[stage]:{subject:`Custom ${stage}`,body:"Current custom copy <safe>"}}}));
    assert.equal(result.status,200);
    assert.equal(result.data.subject,`Custom ${stage}`);
    assert(result.data.html.includes("Current custom copy &lt;safe&gt;"));
    assert(result.data.html.includes("Current studio"));
    assert(result.data.html.includes("June 15, 2031"));
    assert(result.data.html.includes(imageUrl));
    assert(result.data.html.includes('alt="Current photo"'));
    assert(result.data.html.includes("https://venue.example.com/"));
    assert.equal((result.data.html.match(/aria-disabled="true"/g)||[]).length,3);
    assert(!result.data.html.includes("/events/rsvp"));
    assert.equal(result.headers["Cache-Control"],"no-store");
    assert.equal(result.data.placeholders.length,0);
    if (templateKey !== "CLASSIC") assert(result.data.html.includes(themes.getEventTheme(templateKey).background));
  }
});
test("blank drafts disclose sample values and retain provided content",async()=>{
  const blank = await route().POST(request({startsAt:null,templateKey:"CHRISTMAS"}));
  assert.equal(blank.status,200);
  assert.deepEqual(Array.from(blank.data.placeholders),["Event title","Description","Location","Event date"]);
  assert(blank.data.html.includes("December 15, 2030"));
  assert(blank.data.html.includes("Your event title"));
  const filled = await route().POST(request({...base,imageUrl:null}));
  assert(filled.data.html.includes("New description &amp; details"));
});
test("draft preview uses a fixed Alex sample without reading client identity",async()=>{
  for (const templateKey of themes.EVENT_TEMPLATE_KEYS) for (const stage of ["INITIAL","FOLLOW_UP","REMINDER"]) {
    const result = await route().POST(request({...base,templateKey,stage,recipientFirstName:"Private recipient",emailContent:{[stage]:{subject:"For {{FIRST_NAME}}",body:"Hi {{FIRST_NAME}}, see you soon, {{FIRST_NAME}}."}}}));
    assert.equal(result.status,200);
    assert.equal(result.data.subject,"For Alex");
    assert(result.data.html.includes("Hi Alex, see you soon, Alex."));
    assert(!result.data.html.includes("Private recipient"));
  }
});
test("all email styles and stages escape recipient names and keep link/image fields intact",()=>{
  for (const templateKey of themes.EVENT_TEMPLATE_KEYS) for (const stage of ["INITIAL","FOLLOW_UP","REMINDER"]) {
    const event = {...base,startsAt:new Date(base.startsAt),templateKey,imageUrl:`${mediaBase}/{{FIRST_NAME}}.png`,imageAlt:"Photo for {{FIRST_NAME}}",venueUrl:"https://venue.example.com/{{FIRST_NAME}}",emailContent:{[stage]:{subject:"{{FIRST_NAME}}, you're invited",body:"Hi {{FIRST_NAME}},\n\nThanks, {{FIRST_NAME}}."}}};
    for (const name of ["李明", "<script>alert('x')</script> & \"O’Connor\"", "[Click](https://untrusted.example/) **Bold**", "Anna\r\nBcc: Other\u0000"]) {
      const result = email.renderEventEmail(event,stage,"token-{{FIRST_NAME}}","unsubscribe-{{FIRST_NAME}}",{recipientFirstName:name});
      assert(!/<script|https:\/\/untrusted\.example\/[^<]*"/.test(result.html));
      assert(!/[\p{Cc}\p{Zl}\p{Zp}]/u.test(result.subject));
      assert(result.html.includes("token=token-%7B%7BFIRST_NAME%7D%7D"));
      assert(result.html.includes("token=unsubscribe-%7B%7BFIRST_NAME%7D%7D"));
      assert(result.html.includes("https://venue.example.com/%7B%7BFIRST_NAME%7D%7D"));
      assert(result.html.includes(`${mediaBase}/%7B%7BFIRST_NAME%7D%7D.png`));
      assert(result.html.includes('alt="Photo for {{FIRST_NAME}}"'));
      if (name.includes("<script>")) assert(result.html.includes("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;O’Connor&quot;"));
      if (name.includes("[Click]")) assert(result.html.includes("[Click](https://untrusted.example/) **Bold**"));
    }
    for (const recipientFirstName of [undefined,null,""," \n "]) {
      assert(email.renderEventEmail(event,stage,"live-token","unsubscribe",{recipientFirstName}).html.includes("Hi there,"));
    }
    assert(email.renderEventEmail(event,stage,"live-token").html.includes("Hi there,"));
    assert(email.renderEventEmail(event,stage).html.includes("Hi Alex,"));
    assert(email.renderEventEmail(event,stage,undefined,undefined,{}).html.includes("Hi there,"));
  }
});
test("Classic literal-name markers cannot collide with authored copy, links or recipient names",()=>{
  const marker="\uE000EVENTFIRSTNAME\uE001";
  const firstName=`${marker} **Alex** & <safe>`;
  const event={...base,startsAt:new Date(base.startsAt),templateKey:"CLASSIC",venueUrl:`https://venue.example.com/${marker}`,emailContent:{INITIAL:{subject:"For {{FIRST_NAME}}",body:`Keep ${marker} and ${marker}\uE001.\n\nHi {{FIRST_NAME}}. Keep [venue](https://venue.example.com/{{FIRST_NAME}}).`}}};
  const result=email.renderEventEmail(event,"INITIAL","live-token","unsubscribe",{recipientFirstName:firstName});
  assert(result.html.includes(`Keep ${marker} and ${marker}\uE001.`));
  assert(result.html.includes(`Hi ${marker} **Alex** &amp; &lt;safe&gt;.`));
  assert(result.html.includes('href="https://venue.example.com/{{FIRST_NAME}}"'));
  assert(result.html.includes(`href="https://venue.example.com/${encodeURIComponent(marker)}"`));
  assert(!result.html.includes("<strong>Alex</strong>"));
});
test("authentication runs before parsing or rendering and errors are private",async()=>{
  const denied = route(async()=>{throw new Error("Administrator access required.");});
  const result = await denied.POST({get body(){throw new Error("Must not parse unauthenticated requests");}});
  assert.equal(result.status,403);
  assert.equal(result.headers["Cache-Control"],"no-store");
});
test("image checks use active workspace ownership and reject foreign uploads and gallery assets",async()=>{
  imageQueries = [];
  for(const url of [imageUrl.replace("/workspace/","/other/"),`${mediaBase}/projects/foreign/photo.jpg`]) {
    const result = await route().POST(request({...base,imageUrl:url}));
    assert.equal(result.status,400);
  }
  assert.equal(imageQueries.length,2);
  assert(imageQueries.every(q=>q.where.project.workspaceId === "workspace"));
});
test("invalid or oversized nonblank inputs are rejected rather than replaced",async()=>{
  const invalid = [null,[],"draft",{title:7},{title:"x".repeat(161)},{description:"x".repeat(10001)},{location:"x".repeat(501)},{imageAlt:"x".repeat(301)},{startsAt:"nonsense"},{startsAt:"2031-02-30T18:00:00.000Z"},{startsAt:"2031-06-15T18:00:00"},{timeZone:"Invalid/Zone"},{stage:"UNKNOWN"},{templateKey:"UNKNOWN"},{imageUrl:"https://evil.example.com/photo.png"},{venueUrl:"javascript:alert(1)"},{emailContent:[]},{emailContent:{INITIAL:{subject:42}}},{emailContent:{INITIAL:{subject:"line\nbreak"}}},{emailContent:{INITIAL:{body:"x".repeat(10001)}}}];
  for (const input of invalid) {
    const result = await route().POST(request(input));
    assert.equal(result.status,400,JSON.stringify(input).slice(0,100));
  }
  const malformed = new Request("https://studio.example.com",{method:"POST",body:"{"});
  assert.equal((await route().POST(malformed)).status,400);
  const oversized = new Request("https://studio.example.com",{method:"POST",body:" ".repeat(preview.EVENT_PREVIEW_MAX_BYTES+1)});
  assert.equal((await route().POST(oversized)).status,400);
  const oversizedHeader = new Request("https://studio.example.com",{method:"POST",headers:{"content-length":String(preview.EVENT_PREVIEW_MAX_BYTES+1)},body:"{}"});
  assert.equal((await route().POST(oversizedHeader)).status,400);
});
