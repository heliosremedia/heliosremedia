import type { SocialPlatformName } from "./core";
import { sanitizeProviderMessage } from "./publishing-core";

export type ProviderErrorCategory = "AUTHENTICATION" | "PERMISSION" | "VALIDATION" | "RATE_LIMIT" | "TRANSIENT" | "PROVIDER_PROCESSING" | "AMBIGUOUS" | "CONFIGURATION" | "UNKNOWN";
export type PublishPayload = {
  platform: SocialPlatformName; postType: string; caption: string; hashtags: string[];
  destinationLink?: string; media: Array<{ url: string; mimeType?: string | null; altText?: string | null }>;
};
export type ValidationIssue = { severity: "WARNING" | "BLOCKING"; code: string; message: string };
export type PublishResult = {
  outcome: "PUBLISHED" | "PROVIDER_PROCESSING" | "TRANSFERRED_AS_DRAFT" | "REQUIRES_MANUAL_COMPLETION";
  providerSubmissionId?: string; externalPostId?: string; publicUrl?: string;
};
export interface SocialProviderAdapter {
  platform: SocialPlatformName;
  validatePost(payload: PublishPayload): ValidationIssue[];
  publish(payload: PublishPayload, accessToken: string, destinationId: string, idempotencyKey: string): Promise<PublishResult>;
}

const imageTypes = new Set(["SINGLE_IMAGE", "IMAGE_POST"]);
const videoTypes = new Set(["REEL", "VIDEO_POST"]);
function commonValidation(payload: PublishPayload): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!payload.caption.trim() && payload.postType !== "IMAGE_POST") issues.push({ severity: "BLOCKING", code: "caption_required", message: "Add post copy before direct publishing." });
  if (imageTypes.has(payload.postType) && !payload.media.some((item) => item.mimeType?.startsWith("image/"))) issues.push({ severity: "BLOCKING", code: "image_required", message: "This post type requires an eligible image." });
  if (videoTypes.has(payload.postType) && !payload.media.some((item) => item.mimeType?.startsWith("video/"))) issues.push({ severity: "BLOCKING", code: "video_required", message: "This post type requires an eligible video." });
  for (const media of payload.media) if (!media.url.startsWith("https://")) issues.push({ severity: "BLOCKING", code: "https_media_required", message: "Provider media must use a durable public HTTPS URL." });
  return issues;
}

function unconfiguredPublish(platform: string): never {
  throw Object.assign(new Error(`${platform} direct publishing is not configured for this environment.`), { category: "CONFIGURATION" as const, retryable: false });
}

async function providerJson(url:string,init:RequestInit){
  const response=await fetch(url,{...init,cache:"no-store"});
  const data=await response.json() as Record<string,unknown>;
  if(!response.ok||data.error){
    const status=response.status;const providerError=(data.error||{}) as Record<string,unknown>;const code=String(providerError.code||status);
    const category=code==="190"?"AUTHENTICATION":status===401?"AUTHENTICATION":status===403||code==="10"||code==="200"?"PERMISSION":status===429||["4","17","32"].includes(code)?"RATE_LIMIT":status>=500||providerError.is_transient?"TRANSIENT":"VALIDATION";
    const safe=category==="AUTHENTICATION"?"The Meta access token expired or was revoked. Reconnect before publishing.":category==="PERMISSION"?"Meta permission to publish to this destination was removed. Reconnect the account.":category==="RATE_LIMIT"?"Meta is temporarily limiting publishing. Helios will retry safely.":"Meta rejected this post. Review its copy and media requirements.";
    throw Object.assign(new Error(safe),{
      category,retryable:category==="RATE_LIMIT"||category==="TRANSIENT",providerCode:code,
    });
  }
  return data;
}

async function publishInstagram(payload:PublishPayload,token:string,destinationId:string){
  if(!process.env.META_APP_ID) return unconfiguredPublish("Instagram");
  const graph=`https://graph.facebook.com/v23.0/${encodeURIComponent(destinationId)}`;
  const caption=[payload.caption,...payload.hashtags].filter(Boolean).join("\n\n");
  let creationId="";
  if(payload.postType==="CAROUSEL"){
    const children:string[]=[];
    for(const media of payload.media.slice(0,10)){
      const child=await providerJson(`${graph}/media`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({image_url:media.url,is_carousel_item:true,access_token:token})});
      if(typeof child.id!=="string") throw Object.assign(new Error("Instagram did not return a carousel item identifier."),{category:"AMBIGUOUS",ambiguous:true});
      children.push(child.id);
    }
    const container=await providerJson(`${graph}/media`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({media_type:"CAROUSEL",children,caption,access_token:token})});
    creationId=typeof container.id==="string"?container.id:"";
  } else {
    const media=payload.media[0];
    const container=await providerJson(`${graph}/media`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload.postType==="REEL"?{media_type:"REELS",video_url:media?.url,caption,access_token:token}:{image_url:media?.url,caption,access_token:token})});
    creationId=typeof container.id==="string"?container.id:"";
  }
  if(!creationId) throw Object.assign(new Error("Instagram container creation returned no identifier."),{category:"AMBIGUOUS",ambiguous:true});
  for(let attempt=0;attempt<8;attempt++){
    const status=await providerJson(`https://graph.facebook.com/v23.0/${encodeURIComponent(creationId)}?fields=status_code,status`,{method:"GET",headers:{Authorization:`Bearer ${token}`}});
    if(status.status_code==="FINISHED") break;
    if(status.status_code==="ERROR"||status.status_code==="EXPIRED") throw Object.assign(new Error("Instagram could not process this media. Check its dimensions, file type, and public URL."),{category:"PROVIDER_PROCESSING",retryable:false});
    if(attempt===7) throw Object.assign(new Error("Instagram is still processing this media. Helios will retry without creating a duplicate."),{category:"PROVIDER_PROCESSING",retryable:true});
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  const published=await providerJson(`${graph}/media_publish`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({creation_id:creationId,access_token:token})});
  if(typeof published.id!=="string") throw Object.assign(new Error("Instagram publication returned an ambiguous result."),{category:"AMBIGUOUS",ambiguous:true});
  const details=await providerJson(`https://graph.facebook.com/v23.0/${encodeURIComponent(published.id)}?fields=permalink`,{method:"GET",headers:{Authorization:`Bearer ${token}`}});
  return {outcome:"PUBLISHED" as const,providerSubmissionId:creationId,externalPostId:published.id,publicUrl:typeof details.permalink==="string"?details.permalink:undefined};
}

async function publishFacebook(payload:PublishPayload,token:string,destinationId:string){
  if(!process.env.META_APP_ID) return unconfiguredPublish("Facebook");
  const graph=`https://graph.facebook.com/v23.0/${encodeURIComponent(destinationId)}`;
  const message=[payload.caption,...payload.hashtags].filter(Boolean).join("\n\n");
  let result:Record<string,unknown>;
  if(payload.postType==="IMAGE_POST"){
    result=await providerJson(`${graph}/photos`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:payload.media[0]?.url,message,access_token:token})});
  } else if(payload.postType==="MULTI_IMAGE_POST"){
    const attached_media=[];
    for(const media of payload.media){
      const upload=await providerJson(`${graph}/photos`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url:media.url,published:false,access_token:token})});
      if(typeof upload.id==="string") attached_media.push({media_fbid:upload.id});
    }
    result=await providerJson(`${graph}/feed`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,attached_media,access_token:token})});
  } else if(payload.postType==="VIDEO_POST"){
    result=await providerJson(`${graph}/videos`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({file_url:payload.media[0]?.url,description:message,access_token:token})});
  } else {
    result=await providerJson(`${graph}/feed`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message,link:payload.destinationLink||undefined,access_token:token})});
  }
  const id=typeof result.id==="string"?result.id:typeof result.post_id==="string"?result.post_id:"";
  if(!id) throw Object.assign(new Error("Facebook returned an ambiguous publication result."),{category:"AMBIGUOUS",ambiguous:true});
  return {outcome:"PUBLISHED" as const,externalPostId:id,publicUrl:`https://www.facebook.com/${id.replace("_","/posts/")}`};
}

async function publishLinkedIn(payload:PublishPayload,token:string,destinationId:string){
  if(!process.env.LINKEDIN_CLIENT_ID) return unconfiguredPublish("LinkedIn");
  const content=payload.postType==="LINK_POST"&&payload.destinationLink?{article:{source:payload.destinationLink,title:payload.caption.slice(0,200)}}:undefined;
  const result=await providerJson("https://api.linkedin.com/rest/posts",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json","LinkedIn-Version":"202607","X-Restli-Protocol-Version":"2.0.0"},body:JSON.stringify({author:destinationId.startsWith("urn:")?destinationId:`urn:li:organization:${destinationId}`,commentary:[payload.caption,...payload.hashtags].filter(Boolean).join("\n\n"),visibility:"PUBLIC",distribution:{feedDistribution:"MAIN_FEED",targetEntities:[],thirdPartyDistributionChannels:[]},content,lifecycleState:"PUBLISHED",isReshareDisabledByAuthor:false})});
  const id=typeof result.id==="string"?result.id:"";
  if(!id) throw Object.assign(new Error("LinkedIn returned an ambiguous publication result."),{category:"AMBIGUOUS",ambiguous:true});
  return {outcome:"PUBLISHED" as const,externalPostId:id};
}

async function transferTikTok(payload:PublishPayload,token:string){
  if(!process.env.TIKTOK_CLIENT_KEY) return unconfiguredPublish("TikTok");
  const media=payload.media.find(item=>item.mimeType?.startsWith("video/"));
  if(!media) throw Object.assign(new Error("TikTok draft transfer requires an eligible video."),{category:"VALIDATION"});
  const result=await providerJson("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json; charset=UTF-8"},body:JSON.stringify({source_info:{source:"PULL_FROM_URL",video_url:media.url}})});
  const data=result.data as Record<string,unknown>|undefined;const id=typeof data?.publish_id==="string"?data.publish_id:"";
  if(!id) throw Object.assign(new Error("TikTok returned an ambiguous draft-transfer result."),{category:"AMBIGUOUS",ambiguous:true});
  return {outcome:"REQUIRES_MANUAL_COMPLETION" as const,providerSubmissionId:id};
}

export const providerAdapters: Record<SocialPlatformName, SocialProviderAdapter> = {
  INSTAGRAM: { platform: "INSTAGRAM", validatePost: (p) => [...commonValidation(p), ...(["SINGLE_IMAGE","CAROUSEL","REEL"].includes(p.postType) ? [] : [{ severity: "BLOCKING" as const, code: "unsupported_type", message: "This Instagram format is not available for direct publishing." }])], publish: publishInstagram },
  FACEBOOK: { platform: "FACEBOOK", validatePost: (p) => [...commonValidation(p), ...(["TEXT_POST","IMAGE_POST","MULTI_IMAGE_POST","VIDEO_POST","LINK_POST"].includes(p.postType) ? [] : [{ severity: "BLOCKING" as const, code: "unsupported_type", message: "This Facebook Page format is not supported." }])], publish: publishFacebook },
  LINKEDIN: { platform: "LINKEDIN", validatePost: (p) => [...commonValidation(p), ...(["TEXT_POST","LINK_POST"].includes(p.postType) ? [] : [{ severity: "BLOCKING" as const, code: "review_required", message: "LinkedIn media publishing remains manual until asset-upload capability is approved and verified." }])], publish: publishLinkedIn },
  TIKTOK: { platform: "TIKTOK", validatePost: (p) => [...commonValidation(p), ...(["VIDEO_POST","DRAFT_EXPORT"].includes(p.postType) ? [] : [{ severity: "BLOCKING" as const, code: "draft_only", message: "Use TikTok draft transfer or the manual workflow for this format." }])], publish: (p,t) => transferTikTok(p,t) },
  OTHER: { platform: "OTHER", validatePost: () => [{ severity: "BLOCKING", code: "manual_only", message: "Provider-neutral drafts use the manual publishing handoff." }], publish: async () => unconfiguredPublish("Provider-neutral") },
};

export function providerConfiguration(platform: SocialPlatformName) {
  const names = platform === "OTHER" ? [] : platform === "INSTAGRAM" || platform === "FACEBOOK"
    ? ["META_APP_ID", "META_APP_SECRET"]
    : platform === "LINKEDIN" ? ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"] : ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"];
  const missing = platform === "OTHER" ? ["PROVIDER_NEUTRAL_MANUAL_ONLY"] : [...names, "SOCIAL_TOKEN_ENCRYPTION_KEY", "SOCIAL_OAUTH_BASE_URL"].filter((name) => !process.env[name]);
  return { configured: missing.length === 0, missing };
}

export function normalizeProviderError(error: unknown): { category: ProviderErrorCategory; message: string; retryable: boolean; ambiguous: boolean } {
  const value = error as { category?: ProviderErrorCategory; message?: string; retryable?: boolean; ambiguous?: boolean };
  return {
    category: value.category || "UNKNOWN",
    message: sanitizeProviderMessage(value.message || "The provider request failed."),
    retryable: Boolean(value.retryable),
    ambiguous: Boolean(value.ambiguous),
  };
}
