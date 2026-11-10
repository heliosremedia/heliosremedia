/* eslint-disable @typescript-eslint/no-explicit-any */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import sharp from "sharp";
import * as crypto from "node:crypto";
import * as themes from "./themes.ts";
import * as core from "./core.ts";
import * as images from "./images.ts";
import * as emailFormat from "../client-communications/email-format.ts";

const mediaBase = "https://media.example.com/assets";
const imageUrl = `${mediaBase}/events/workspace/12345678-1234-1234-1234-123456789abc.png`;
const future = new Date(Date.now() + 30 * 86_400_000);
const base = {title:"Holiday <Party>",description:"Bring a friend & celebrate.",location:"The Studio",startsAt:future.toISOString(),mode:"ALL"};
const png = await sharp({create:{width:2,height:2,channels:3,background:"#13664c"}}).png().toBuffer();
function load(file: string, mocks: Record<string, unknown>) {
  const source = readFileSync(new URL(file,import.meta.url),"utf8");
  const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports: Record<string, any> = {};
  vm.runInNewContext(js,{exports,require:(name:string)=>{if(!(name in mocks)) throw new Error(`Unexpected import: ${name}`); return mocks[name];},process:{env:{R2_PUBLIC_URL:mediaBase}},Date,URL,Buffer,console,Uint8Array,DataView,Set},{filename:file});
  return exports;
}
const site = {getSiteUrl:()=>"https://studio.example.com"};
const campaign = load("../client-communications/email.ts", {"server-only":{},"@/lib/site":site,"@/lib/newsletters/presentation":{testEmailSubject:(subject:string)=>subject},"./providers/resend":{},"./email-format":emailFormat});
const email = load("./email.ts",{"server-only":{},"@/lib/site":site,"@/lib/client-communications/email":campaign,"./themes":themes});
const next = {NextResponse:{json:(data:unknown,options?:any)=>({data,status:options?.status || 200,headers:options?.headers})}};
const eventError = (error:unknown)=>({status:400,data:{success:false,error:error instanceof Error?error.message:"Failed"}});
const request = (data:unknown)=>({json:async()=>data});

test("all eight templates are unique and unknown saved values fall back to Classic",()=>{
  assert.equal(themes.EVENT_THEMES.length,8);
  assert.deepEqual(themes.EVENT_THEMES.map(t=>t.key),[...themes.EVENT_TEMPLATE_KEYS]);
  assert.equal(themes.getEventTheme("unknown").key,"CLASSIC");
});
test("images allow only configured HTTPS origin/path and static PNG/JPEG without tracking",()=>{
  assert.equal(themes.safeEventImageUrl(imageUrl,[mediaBase]),imageUrl);
  for(const url of ["javascript:alert(1)","data:image/png;base64,xxx","https://other.example.com/image.jpg","https://media.example.com/assets-other/image.jpg","https://media.example.com.evil.test/assets/image.jpg","https://user:password@media.example.com/assets/image.jpg",`${imageUrl}?token=secret`,`${imageUrl}#fragment`,`${mediaBase}/image.svg`,`${mediaBase}/photo.webp`,"http://media.example.com/assets/image.jpg",`${mediaBase}/image\n.jpg`]) assert.equal(themes.safeEventImageUrl(url,[mediaBase]),null,url);
  assert.equal(themes.safeEventImageUrl(imageUrl,[]),null);
});
test("draft create/defaults and partial updates preserve Dates, design and nested email copy",()=>{
  const previous=process.env.R2_PUBLIC_URL;process.env.R2_PUBLIC_URL=mediaBase;
  try {
    assert.equal(core.eventInput(base).templateKey,"CLASSIC");
    const saved=core.eventInput({...base,templateKey:"CHRISTMAS",imageUrl,emailContent:{INITIAL:{subject:"Come celebrate",body:"Hello"},REMINDER:{subject:"Tomorrow!",body:"See you soon"}}});
    const changed=core.eventDraftInput(saved,{emailContent:{REMINDER:{body:"Looking forward to seeing you"}}});
    assert.equal(changed.imageUrl,imageUrl);assert.equal(changed.imageAlt,base.title);assert.equal(changed.templateKey,"CHRISTMAS");assert.equal(+changed.startsAt,+future);
    assert.deepEqual(changed.emailContent.INITIAL,saved.emailContent.INITIAL);assert.equal(changed.emailContent.REMINDER?.subject,"Tomorrow!");
    assert.equal(changed.emailContent.REMINDER?.body,"Looking forward to seeing you");
    assert.equal(core.eventDraftInput(saved,{imageUrl:null}).imageAlt,null);
    assert.deepEqual(core.eventDraftInput(saved,{emailContent:null}).emailContent,{});
    assert.throws(()=>core.eventInput({...base,templateKey:"FORGED"}));
    assert.throws(()=>core.eventInput({...base,imageUrl:"https://tracker.test/one.png"}));
    assert.throws(()=>core.eventInput({...base,venueUrl:"javascript:alert(1)"}));
  } finally { if(previous===undefined)delete process.env.R2_PUBLIC_URL;else process.env.R2_PUBLIC_URL=previous; }
});
test("stage copy has suitable defaults, legacy null stays unchanged, and overrides are bounded",()=>{
  assert.match(themes.getEventEmailCopy({...base,emailContent:{}},"REMINDER").body,/looking forward/);
  assert.equal(themes.getEventEmailCopy({...base,emailContent:null},"REMINDER").body,`${base.title}\n\n${base.description}`);
  assert.equal(themes.getEventEmailCopy({...base,emailContent:{REMINDER:{subject:"Tomorrow",body:"See you!"}}},"REMINDER").body,"See you!");
  assert.throws(()=>themes.normalizeEventEmailContent({INITIAL:{subject:"a".repeat(201)}}));
  assert.throws(()=>themes.normalizeEventEmailContent({INITIAL:{body:"a".repeat(10001)}}));
  assert.throws(()=>themes.normalizeEventEmailContent({INITIAL:{subject:"test\nBCC:other@example.com"}}));
});
test("every template/stage renders safe responsive imagery, details and all RSVP choices",()=>{
  for(const templateKey of themes.EVENT_TEMPLATE_KEYS) for(const stage of core.STAGES) {
    const result=email.renderEventEmail({...base,startsAt:future,timeZone:"America/Denver",templateKey,imageUrl,imageAlt:'Banner " onerror="alert(1)',venueUrl:"https://venue.example.com/?a=1&b=2"},stage, "t".repeat(43),"unsubscribe");
    assert(result.html.includes('width:100%'));assert(result.html.includes('height:auto'));assert(result.html.includes('alt="Banner &quot; onerror=&quot;alert(1)"'));
    assert(!result.html.includes('<Party>'));assert(!result.html.includes('alt="Banner " onerror='));
    for(const response of ["YES","NO","MAYBE"]) assert(result.html.includes(`&amp;response=${response}`));
    assert(result.html.includes('/events/rsvp#token='));assert(!result.html.includes('/events/rsvp?token='));
    assert(result.html.includes("View venue website"));assert(result.html.includes("Unsubscribe from marketing emails"));assert(result.html.includes("The Studio"));
  }
});
test("previews retain visible disabled choices without a usable RSVP token and unsafe images disappear",()=>{
  for(const templateKey of themes.EVENT_TEMPLATE_KEYS) {
    const result=email.renderEventEmail({...base,startsAt:future,timeZone:"America/Denver",templateKey,imageUrl:"https://tracker.test/image.png"},"INITIAL");
    assert.equal((result.html.match(/aria-disabled="true"/g)||[]).length,3);assert(result.html.includes("TEST / PREVIEW ONLY"));assert(!result.html.includes("/events/rsvp"));assert(!result.html.includes("tracker.test"));
  }
});
test("MAYBE remains follow-up eligible, while only YES receives the attendance reminder",()=>{
  assert(core.stageTargets("INITIAL","MAYBE"));assert(core.stageTargets("FOLLOW_UP","MAYBE"));assert(!core.stageTargets("REMINDER","MAYBE"));
});
test("raster validation checks real bytes rather than declared MIME, dimensions and bounded size",()=>{
  assert.equal(images.eventImageType(png),"image/png");
  assert.throws(()=>images.eventImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')));
  assert.throws(()=>images.eventImageType(new Uint8Array(images.EVENT_IMAGE_MAX_BYTES+1)));
  const enormous=Buffer.from(png);enormous.writeUInt32BE(100000,16);enormous.writeUInt32BE(100000,20);assert.throws(()=>images.eventImageType(enormous));
});
test("RSVP GET is private/read-only and only explicit POST stores MAYBE",async()=>{
  let writes=0;const event={...base,startsAt:future,timeZone:"America/Denver",templateKey:"EASTER",imageUrl,imageAlt:"Flowers",venueUrl:"https://venue.example.com",workspaceId:"secret-workspace",emailContent:{INITIAL:{subject:"private"}}};
  const invitation={id:"invite",eventId:"event",email:"secret@example.com",response:"PENDING",event};
  const prisma:any={eventInvitation:{findFirst:async()=>invitation,update:async()=>{writes++;}},eventInvitationEvent:{updateMany:async()=>({count:1})}};prisma.$transaction=async(fn:any)=>fn(prisma);
  const route=load("../../app/api/events/rsvp/route.ts",{"next/server":next,"@/lib/prisma":{prisma},"@/lib/events/themes":themes,"@/lib/events/core":core});
  const get=await route.GET({headers:{get:()=>`Bearer ${"a".repeat(43)}`}});assert.equal(writes,0);assert.equal(get.data.event.templateKey,"EASTER");assert.equal(get.headers["Referrer-Policy"],"no-referrer");assert(!JSON.stringify(get.data).includes("secret"));assert(!("emailContent" in get.data.event));
  const post=await route.POST(request({token:"a".repeat(43),response:"MAYBE"}));assert.equal(post.status,200);assert.equal(post.data.response,"MAYBE");assert.equal(writes,1);
});
test("presigned upload enforces admin gate, positive integer size, MIME and signed length",async()=>{
  let captured:any;let adminCalls=0;
  class PutObjectCommand {input:any;constructor(input:any){this.input=input;}}
  const route=load("../../app/api/admin/events/images/presign/route.ts",{"node:crypto":crypto,"next/server":next,"@aws-sdk/client-s3":{PutObjectCommand},"@aws-sdk/s3-request-presigner":{getSignedUrl:async(_client:any,command:any,options:any)=>{captured={command,options};return "https://upload.example.com";}},"@/lib/r2":{r2Client:{},r2Config:{bucketName:"bucket"}},"@/lib/r2-upload":{getPublicAssetUrl:(key:string)=>`${mediaBase}/${key}`},"@/lib/events/service":{eventAdmin:async()=>{adminCalls++;return {workspaceId:"workspace"};}},"@/lib/events/api":{eventError},"@/lib/events/themes":themes});
  for(const fileSize of [-1,0,NaN,Infinity,1.2,10*1024*1024+1]) assert.equal((await route.POST(request({fileType:"image/png",fileSize}))).status,400);
  assert.equal((await route.POST(request({fileType:"image/svg+xml",fileSize:100}))).status,400);
  const valid=await route.POST(request({fileType:"image/png",fileSize:png.length}));assert.equal(valid.status,200);assert(valid.data.upload.key.startsWith("event-uploads/workspace/"));assert.equal(captured.command.input.ContentLength,png.length);assert(captured.options.signableHeaders.has("content-length"));assert(adminCalls>=8);
});
test("finalizing verifies bytes then writes a distinct non-presigned final object in its own workspace",async()=>{
  const commands:any[]=[];class GetObjectCommand {input:any;constructor(input:any){this.input=input;}}class PutObjectCommand {input:any;constructor(input:any){this.input=input;}}
  const r2Client={send:async(command:any)=>{commands.push(command);return command instanceof GetObjectCommand?{ContentLength:png.length,ContentType:"image/png",Body:(async function*(){yield png;})()}:{};}};
  const route=load("../../app/api/admin/events/images/complete/route.ts",{"sharp":{default:sharp},"node:crypto":crypto,"next/server":next,"@aws-sdk/client-s3":{GetObjectCommand,PutObjectCommand},"@/lib/r2":{r2Client,r2Config:{bucketName:"bucket",publicUrl:mediaBase}},"@/lib/events/service":{eventAdmin:async()=>({workspaceId:"workspace"})},"@/lib/events/api":{eventError},"@/lib/events/images":images,"@/lib/events/themes":themes});
  const key="event-uploads/workspace/12345678-1234-1234-1234-123456789abc.png";
  const denied=await route.POST(request({key:key.replace("workspace","other")}));assert.equal(denied.status,400);assert.equal(commands.length,0);
  const result=await route.POST(request({key}));assert.equal(result.status,200);assert(result.data.imageUrl.startsWith(`${mediaBase}/events/workspace/`));assert.equal(commands.length,2);assert.notEqual(commands[1].input.Key,key);assert.equal(commands[1].input.ContentType,"image/png");assert.equal(commands[1].input.CacheControl,"public, max-age=31536000, immutable");
});
test("finalizing rejects corrupt rasters, MIME mismatch and oversized actual streams without storing",async()=>{
  const corrupt=Buffer.alloc(45);Buffer.from([137,80,78,71,13,10,26,10]).copy(corrupt);corrupt.writeUInt32BE(13,8);corrupt.write("IHDR",12);corrupt.writeUInt32BE(1,16);corrupt.writeUInt32BE(1,20);corrupt.write("IEND",37);
  for(const [bytes,contentType] of [[corrupt,"image/png"],[png,"image/jpeg"],[Buffer.alloc(images.EVENT_IMAGE_MAX_BYTES+1),"image/png"]] as const) {
    const commands:any[]=[];class GetObjectCommand {input:any;constructor(input:any){this.input=input;}}class PutObjectCommand {input:any;constructor(input:any){this.input=input;}}
    const r2Client={send:async(command:any)=>{commands.push(command);return {ContentLength:100,ContentType:contentType,Body:(async function*(){yield bytes;})()};}};
    const route=load("../../app/api/admin/events/images/complete/route.ts",{"sharp":{default:sharp},"node:crypto":crypto,"next/server":next,"@aws-sdk/client-s3":{GetObjectCommand,PutObjectCommand},"@/lib/r2":{r2Client,r2Config:{bucketName:"bucket",publicUrl:mediaBase}},"@/lib/events/service":{eventAdmin:async()=>({workspaceId:"workspace"})},"@/lib/events/api":{eventError},"@/lib/events/images":images,"@/lib/events/themes":themes});
    assert.equal((await route.POST(request({key:"event-uploads/workspace/12345678-1234-1234-1234-123456789abc.png"}))).status,400);assert.equal(commands.length,1);
  }
});
test("gallery reads and media attachment enforce active workspace ownership",async()=>{
  const source=readFileSync(new URL("../../app/api/admin/events/images/route.ts",import.meta.url),"utf8");
  assert(source.includes('project: { workspaceId: session.workspaceId, status: "PUBLISHED"'));assert(source.includes('where: { workspaceId: session.workspaceId, imageUrl:'));
  let mediaQuery:any;
  const service=load("./service.ts",{"server-only":{},"@/lib/client-communications/bounce-core":{},"@/lib/prisma":{prisma:{media:{findFirst:async(query:any)=>{mediaQuery=query;return null;}}}},"@/lib/auth/session":{},"@/lib/client-communications/preferences":{},"@/lib/audit":{},"./themes":themes,"./core":core});
  await service.validateEventImageSelection(imageUrl,"workspace");
  await assert.rejects(()=>service.validateEventImageSelection(imageUrl,"other"));
  assert.equal(mediaQuery.where.project.workspaceId,"other");
  await assert.rejects(()=>service.validateEventImageSelection(`${mediaBase}/projects/id/photo.jpg`,"workspace"));
  assert.equal(mediaQuery.where.project.workspaceId,"workspace");assert.equal(mediaQuery.where.storageKey,"projects/id/photo.jpg");
});
