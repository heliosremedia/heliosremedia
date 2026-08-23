import "server-only";
import { createHash } from "node:crypto";
import { decryptSocialToken, encryptSocialToken } from "./security";

export const META_SCOPES = ["business_management","pages_show_list","pages_read_engagement","pages_manage_posts","instagram_basic","instagram_content_publish"] as const;
export const metaGraphVersion = () => (process.env.META_GRAPH_API_VERSION || "v23.0").replace(/^([^v])/, "v$1");
const graph = (path:string) => `https://graph.facebook.com/${metaGraphVersion()}/${path.replace(/^\//,"")}`;
const clean = (value:unknown,max=500) => typeof value === "string" ? value.trim().slice(0,max) : "";

type MetaError = { message?:string; type?:string; code?:number; error_subcode?:number; is_transient?:boolean };
export type MetaDestination = { key:string; platform:"FACEBOOK"|"INSTAGRAM"; providerAccountId:string; parentProviderAccountId?:string; displayName:string; username?:string; profileImageUrl?:string; encryptedPageToken:string; grantedScopes:string[]; tokenExpiresAt?:string };

export class MetaApiError extends Error {
  code:string; retryable:boolean;
  constructor(message:string,code="META_ERROR",retryable=false){super(message);this.code=code;this.retryable=retryable;}
}

async function metaJson(path:string,init:RequestInit={},token?:string){
  const response=await fetch(graph(path),{...init,headers:{Accept:"application/json",...(token?{Authorization:`Bearer ${token}`}:{ }),...(init.headers||{})},cache:"no-store"});
  const data=await response.json().catch(()=>({})) as Record<string,unknown>;
  if(!response.ok || data.error){
    const error=(data.error||{}) as MetaError; const code=String(error.code||response.status);
    throw new MetaApiError(clean(error.message)||"Meta could not complete the request.",code,Boolean(error.is_transient)||response.status===429||response.status>=500);
  }
  return data;
}

export async function exchangeMetaCode(input:{code:string;redirectUri:string}){
  const clientId=process.env.META_APP_ID||"";const clientSecret=process.env.META_APP_SECRET||"";
  if(!clientId||!clientSecret) throw new MetaApiError("Meta application credentials are incomplete.","CONFIGURATION");
  const body=new URLSearchParams({client_id:clientId,client_secret:clientSecret,redirect_uri:input.redirectUri,code:input.code});
  const initial=await metaJson("oauth/access_token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body});
  const shortToken=clean(initial.access_token,5000);if(!shortToken) throw new MetaApiError("Meta returned no usable authorization.","TOKEN_EXCHANGE");
  const extendedBody=new URLSearchParams({grant_type:"fb_exchange_token",client_id:clientId,client_secret:clientSecret,fb_exchange_token:shortToken});
  const extended=await metaJson("oauth/access_token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:extendedBody});
  const accessToken=clean(extended.access_token,5000)||shortToken;const expiresIn=Number(extended.expires_in||initial.expires_in)||0;
  return {accessToken,tokenExpiresAt:expiresIn?new Date(Date.now()+expiresIn*1000):undefined};
}

export async function discoverMetaDestinations(accessToken:string,tokenExpiresAt?:Date):Promise<MetaDestination[]>{
  const [accounts,permissions]=await Promise.all([
    metaJson("me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&limit=100",{},accessToken),
    metaJson("me/permissions",{},accessToken),
  ]);
  const granted=new Set(((permissions.data as Array<Record<string,unknown>>|undefined)||[]).filter(x=>x.status==="granted").map(x=>clean(x.permission,100)));
  const missing=META_SCOPES.filter(scope=>!granted.has(scope));
  if(missing.includes("pages_show_list")||missing.includes("pages_manage_posts")) throw new MetaApiError(`Required Meta permission was not granted: ${missing.join(", ")}.`,"PERMISSION_MISSING");
  const destinations:MetaDestination[]=[];
  for(const page of ((accounts.data as Array<Record<string,unknown>>|undefined)||[])){
    const pageId=clean(page.id,200),pageName=clean(page.name,300),pageToken=clean(page.access_token,5000);
    if(!pageId||!pageToken) continue;
    const encryptedPageToken=encryptSocialToken({accessToken:pageToken,tokenType:"page",source:"meta-oauth"});
    destinations.push({key:`FACEBOOK:${pageId}`,platform:"FACEBOOK",providerAccountId:pageId,displayName:pageName||"Facebook Page",encryptedPageToken,grantedScopes:[...granted],tokenExpiresAt:tokenExpiresAt?.toISOString()});
    const instagram=page.instagram_business_account as Record<string,unknown>|undefined;const instagramId=clean(instagram?.id,200);
    if(instagramId) destinations.push({key:`INSTAGRAM:${instagramId}`,platform:"INSTAGRAM",providerAccountId:instagramId,parentProviderAccountId:pageId,displayName:clean(instagram?.username,200)||`${pageName} Instagram`,username:clean(instagram?.username,200),profileImageUrl:clean(instagram?.profile_picture_url,2000),encryptedPageToken,grantedScopes:[...granted],tokenExpiresAt:tokenExpiresAt?.toISOString()});
  }
  return destinations;
}

export async function testMetaConnection(connection:{platform:string;providerAccountId:string|null;parentProviderAccountId:string|null;encryptedTokenPayload:string|null;grantedScopes:unknown}){
  if(!connection.providerAccountId||!connection.encryptedTokenPayload) throw new MetaApiError("Reconnect Meta and select a real destination.","DESTINATION_MISSING");
  const tokens=decryptSocialToken(connection.encryptedTokenPayload);const token=clean(tokens.accessToken,5000);if(!token) throw new MetaApiError("The stored Meta authorization is unavailable.","TOKEN_MISSING");
  const required=connection.platform==="INSTAGRAM"?["instagram_basic","instagram_content_publish"]:["pages_read_engagement","pages_manage_posts"];
  const scopes=Array.isArray(connection.grantedScopes)?connection.grantedScopes.filter((x):x is string=>typeof x==="string"):[];
  const missing=required.filter(scope=>!scopes.includes(scope));if(missing.length) throw new MetaApiError(`Reconnect and grant: ${missing.join(", ")}.`,"PERMISSION_MISSING");
  const fields=connection.platform==="INSTAGRAM"?"id,username":"id,name";
  const identity=await metaJson(`${encodeURIComponent(connection.providerAccountId)}?fields=${fields}`,{},token);
  if(clean(identity.id)!==connection.providerAccountId) throw new MetaApiError("Meta returned a different destination identity.","IDENTITY_MISMATCH");
  if(connection.platform==="INSTAGRAM"&&connection.parentProviderAccountId){
    const page=await metaJson(`${encodeURIComponent(connection.parentProviderAccountId)}?fields=instagram_business_account`,{},token);
    const linked=(page.instagram_business_account as Record<string,unknown>|undefined)?.id;
    if(linked!==connection.providerAccountId) throw new MetaApiError("This Instagram account is no longer linked to the selected Facebook Page.","INSTAGRAM_UNLINKED");
  }
  return {displayName:clean(identity.name)||clean(identity.username)||connection.providerAccountId};
}

export const hashOAuthState=(state:string)=>createHash("sha256").update(state).digest("hex");
export function publicDestination(destination:MetaDestination){return {key:destination.key,platform:destination.platform,providerAccountId:destination.providerAccountId,parentProviderAccountId:destination.parentProviderAccountId,displayName:destination.displayName,username:destination.username,profileImageUrl:destination.profileImageUrl,grantedScopes:destination.grantedScopes,tokenExpiresAt:destination.tokenExpiresAt};}
