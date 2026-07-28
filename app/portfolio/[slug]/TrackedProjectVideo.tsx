"use client";
import ViewportVideoFrame from "./ViewportVideoFrame";

function emit(projectId:string,mediaId:string,eventName:string,milestone?:number){
  window.dispatchEvent(new CustomEvent("helios:portfolio-analytics",{detail:{eventName,projectId,channel:"video",target:`#media-${mediaId}`,metadata:milestone?{milestone}:undefined,onceKey:`${eventName}:${projectId}:${mediaId}`}}));
}

export default function TrackedProjectVideo({projectId,mediaId,title,embedUrl,playbackUrl}:{projectId:string;mediaId:string;title:string;embedUrl?:string;playbackUrl?:string}){
  if(embedUrl)return <ViewportVideoFrame src={embedUrl} title={title} autoplay={false} projectId={projectId} mediaId={mediaId} className="aspect-video w-full border-0 bg-black"/>;
  if(!playbackUrl)return null;
  return <video src={playbackUrl} controls playsInline preload="metadata" className="aspect-video w-full bg-black object-contain" onPlay={()=>emit(projectId,mediaId,"VIDEO_START")} onTimeUpdate={event=>{const video=event.currentTarget;if(!video.duration)return;const ratio=video.currentTime/video.duration;if(ratio>=.75)emit(projectId,mediaId,"VIDEO_PROGRESS_75",75);else if(ratio>=.5)emit(projectId,mediaId,"VIDEO_PROGRESS_50",50);else if(ratio>=.25)emit(projectId,mediaId,"VIDEO_PROGRESS_25",25);}} onEnded={()=>emit(projectId,mediaId,"VIDEO_COMPLETE",100)}>Your browser cannot play this hosted video.</video>;
}
