"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Status = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type BlogEditorPost = {
  id:string; title:string; slug:string; excerpt:string|null; content:string; author:string|null; category:string|null;
  status:Status; scheduledAt:string|null; publishedAt:string|null; archivedAt:string|null; featuredMediaId:string|null;
  featuredImageStorageKey:string|null; featuredImageUrl:string|null; featuredImageAlt:string|null; seoTitle:string|null;
  seoDescription:string|null; canonicalUrl:string|null; socialCaption:string|null; sourceLinks:string[];
  createdAt:string; updatedAt:string;
};
export type BlogImageOption = {
  id:string; url:string; alt:string; projectId:string; property:string; location:string;
  caption:string; category:string; categoryLabel:string;
};
type Draft = Omit<BlogEditorPost,"id"|"createdAt"|"updatedAt"|"archivedAt">;
const empty = (author:string):Draft => ({ title:"",slug:"",excerpt:"",content:"",author,category:"",status:"DRAFT",scheduledAt:null,publishedAt:null,featuredMediaId:null,featuredImageStorageKey:null,featuredImageUrl:null,featuredImageAlt:"",seoTitle:"",seoDescription:"",canonicalUrl:"",socialCaption:"",sourceLinks:[] });
const input = "mt-2 w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]";
const normalize = (value:string) => value.toLowerCase().replace(/[_-]+/g," ").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();
const hash = (value:string) => {let result=2166136261;for(let index=0;index<value.length;index++){result^=value.charCodeAt(index);result=Math.imul(result,16777619);}return result>>>0;};
const searchText = (item:BlogImageOption) => normalize(`${item.property} ${item.location} ${item.caption} ${item.alt} ${item.category} ${item.categoryLabel}`);

export default function BlogStudio({initialPosts,images,defaultAuthor}:{initialPosts:BlogEditorPost[];images:BlogImageOption[];defaultAuthor:string}) {
  const [posts,setPosts]=useState(initialPosts); const [activeId,setActiveId]=useState<string|null>(null); const [draft,setDraft]=useState<Draft>(empty(defaultAuthor));
  const [brief,setBrief]=useState(""); const [busy,setBusy]=useState(false); const [message,setMessage]=useState<string|null>(null); const [imageQuery,setImageQuery]=useState("");
  const [gallerySeed,setGallerySeed]=useState(0); const [visibleImageCount,setVisibleImageCount]=useState(15);
  const [linkSuggestions,setLinkSuggestions]=useState<Array<{label:string;href:string}>>([]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>setGallerySeed(Math.floor(Math.random()*1_000_000_000)));return()=>cancelAnimationFrame(frame);},[]);
  const shownImages=useMemo(()=>{
    const terms=normalize(imageQuery).split(" ").filter(Boolean);
    const matches=terms.length?images.filter(item=>terms.every(term=>searchText(item).includes(term))):images;
    const projectIds=[...new Set(matches.map(item=>item.projectId))].sort((a,b)=>hash(`${gallerySeed}:${a}`)-hash(`${gallerySeed}:${b}`));
    const projectImages=new Map(projectIds.map(projectId=>[projectId,matches.filter(item=>item.projectId===projectId).sort((a,b)=>hash(`${gallerySeed}:${a.id}`)-hash(`${gallerySeed}:${b.id}`))]));
    const diverse:BlogImageOption[]=[];
    for(let index=0;diverse.length<matches.length;index++){
      let added=false;
      for(const projectId of projectIds){const item=projectImages.get(projectId)?.[index];if(item){diverse.push(item);added=true;}}
      if(!added)break;
    }
    return diverse;
  },[images,imageQuery,gallerySeed]);
  function edit(post:BlogEditorPost){setActiveId(post.id);setDraft({...post});setMessage(null);}
  function create(){setActiveId(null);setDraft(empty(defaultAuthor));setImageQuery("");setVisibleImageCount(15);setGallerySeed(Math.floor(Math.random()*1_000_000_000));setMessage(null);}
  function patch<K extends keyof Draft>(key:K,value:Draft[K]){setDraft(current=>({...current,[key]:value}));}
  async function save(){
    setBusy(true);setMessage("Saving…");
    try{const response=await fetch("/api/admin/blog",{method:activeId?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...draft,...(activeId?{postId:activeId}:{})})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||"Unable to save.");
      const post={...data.post,sourceLinks:Array.isArray(data.post.sourceLinks)?data.post.sourceLinks:[]};setPosts(current=>activeId?current.map(item=>item.id===activeId?post:item):[post,...current]);setActiveId(post.id);setDraft(post);setMessage("Article saved ✓");
    }catch(error){setMessage(error instanceof Error?error.message:"Unable to save.");}finally{setBusy(false);}
  }
  async function remove(){if(!activeId||!confirm("Permanently delete this article?"))return;setBusy(true);const response=await fetch(`/api/admin/blog?postId=${activeId}`,{method:"DELETE"});if(response.ok){setPosts(current=>current.filter(item=>item.id!==activeId));create();}else setMessage("The article could not be deleted.");setBusy(false);}
  async function ai(action:string){
    const source=action==="draft"?brief:draft.content;if(!source.trim())return setMessage("Add a brief or article first.");
    setBusy(true);setMessage("AI is writing…");
    try{const response=await fetch("/api/admin/blog/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,input:source})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||"AI request failed.");
      const result=data.result||{};setDraft(current=>({...current,title:result.title||current.title,slug:result.slug||current.slug,excerpt:result.excerpt||current.excerpt,content:result.content||current.content,category:result.category||current.category,seoTitle:result.seoTitle||current.seoTitle,seoDescription:result.seoDescription||current.seoDescription,socialCaption:result.socialCaption||result.facebook||current.socialCaption}));setLinkSuggestions(Array.isArray(result.suggestedInternalLinks)?result.suggestedInternalLinks.map((item:unknown)=>typeof item==="string"?{label:item,href:item}:item).filter((item:unknown):item is {label:string;href:string}=>Boolean(item&&typeof item==="object"&&"href" in item&&typeof item.href==="string"&&item.href.startsWith("/"))):[]);setMessage("AI draft added. Review every detail before publishing.");
    }catch(error){setMessage(error instanceof Error?error.message:"AI request failed.");}finally{setBusy(false);}
  }
  async function upload(file:File){
    setBusy(true);setMessage("Uploading image…");
    try{const response=await fetch("/api/admin/blog/presign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileName:file.name,fileType:file.type,fileSize:file.size})});const data=await response.json();if(!response.ok||!data.success)throw new Error(data.error||"Upload could not start.");
      const put=await fetch(data.upload.uploadUrl,{method:"PUT",headers:{"Content-Type":data.upload.contentType},body:file});if(!put.ok)throw new Error("Image upload failed.");
      setDraft(current=>({...current,featuredMediaId:null,featuredImageStorageKey:data.upload.key,featuredImageUrl:data.upload.publicUrl,featuredImageAlt:current.featuredImageAlt||file.name.replace(/\.[^.]+$/,"")}));setMessage("Image uploaded ✓");
    }catch(error){setMessage(error instanceof Error?error.message:"Upload failed.");}finally{setBusy(false);}
  }
  function surprise(){
    if(!shownImages.length)return;
    const current=images.find(item=>item.id===draft.featuredMediaId);
    const projects=[...new Set(shownImages.map(item=>item.projectId).filter(projectId=>projectId!==current?.projectId))];
    const availableProjects=projects.length?projects:[...new Set(shownImages.map(item=>item.projectId))];
    const projectId=availableProjects[Math.floor(Math.random()*availableProjects.length)];
    const candidates=shownImages.filter(item=>item.projectId===projectId&&item.id!==current?.id);
    const item=(candidates.length?candidates:shownImages)[Math.floor(Math.random()*(candidates.length?candidates:shownImages).length)];
    patch("featuredMediaId",item.id);patch("featuredImageStorageKey",null);patch("featuredImageUrl",null);patch("featuredImageAlt",item.alt);
    setVisibleImageCount(15);
    setGallerySeed(Math.floor(Math.random()*1_000_000_000));
  }
  const selected=images.find(item=>item.id===draft.featuredMediaId);const imageUrl=draft.featuredImageUrl||selected?.url||null;
  return <div className="space-y-7">
    <section className="flex flex-col gap-5 border-b border-white/[0.08] pb-7 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow text-[var(--helios-orange)]">Editorial</p><h1 className="mt-3 text-3xl font-light text-white sm:text-4xl">Blog Studio</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Write, refine, preview, schedule, and publish brand-led articles from one place.</p></div><button onClick={create} className="admin-btn-primary">New article</button></section>
    <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="space-y-2">{posts.map(post=><button key={post.id} onClick={()=>edit(post)} className={`w-full rounded-xl border p-4 text-left transition ${activeId===post.id?"border-[var(--helios-orange)] bg-[var(--helios-orange)]/[0.06]":"border-white/[0.08] bg-white/[0.02] hover:border-white/20"}`}><p className="line-clamp-2 text-sm text-white/75">{post.title}</p><p className="mt-2 text-[0.5rem] uppercase tracking-[0.13em] text-white/30">{post.status} · {new Date(post.updatedAt).toLocaleDateString()}</p></button>)}{!posts.length&&<p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-white/30">Your first article will appear here.</p>}</aside>
      <main className="admin-form-scope space-y-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111] p-5 sm:p-7">
        <section className="rounded-xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[0.04] p-5"><label className="text-xs text-white/45">AI writing brief<textarea rows={3} value={brief} onChange={e=>setBrief(e.target.value)} placeholder="Example: Explain why twilight photography helps luxury listings stand out in Northern Colorado…" className={input}/></label><div className="mt-3 flex flex-wrap items-center gap-2"><button disabled={busy} onClick={()=>ai("draft")} className="admin-btn-primary">Generate draft</button>{message==="AI is writing…"&&<span role="status" className="ml-1 text-sm text-emerald-300">AI is writing…</span>}{draft.content&&<><button disabled={busy} onClick={()=>ai("improve")} className="admin-btn-secondary">Refine article</button><button disabled={busy} onClick={()=>ai("shorten")} className="admin-btn-secondary">Shorten</button><button disabled={busy} onClick={()=>ai("expand")} className="admin-btn-secondary">Expand</button><button disabled={busy} onClick={()=>ai("social")} className="admin-btn-secondary">Social captions</button></>}</div><p className="mt-3 text-xs leading-5 text-white/30">AI always writes into a draft. Review facts, links, and claims before publishing.</p></section>
        <div className="grid gap-5 sm:grid-cols-2"><label className="text-xs text-white/40">Title<input value={draft.title} onChange={e=>patch("title",e.target.value)} className={input}/></label><label className="text-xs text-white/40">URL slug<input value={draft.slug} onChange={e=>patch("slug",e.target.value)} placeholder="generated-from-title" className={input}/></label><label className="text-xs text-white/40">Author<input value={draft.author||""} onChange={e=>patch("author",e.target.value)} className={input}/></label><label className="text-xs text-white/40">Category<input value={draft.category||""} onChange={e=>patch("category",e.target.value)} placeholder="Marketing insights" className={input}/></label></div>
        <label className="block text-xs text-white/40">Excerpt<textarea rows={3} value={draft.excerpt||""} onChange={e=>patch("excerpt",e.target.value)} className={input}/></label>
        <label className="block text-xs text-white/40">Article content<textarea rows={20} value={draft.content} onChange={e=>patch("content",e.target.value)} placeholder={"Use Markdown headings such as ## A thoughtful heading\n\nWrite the article in clear paragraphs."} className={`${input} font-mono leading-7`}/></label>{linkSuggestions.length>0&&<div className="rounded-xl border border-white/[0.08] bg-black/20 p-4"><p className="text-[0.52rem] uppercase tracking-[0.14em] text-white/30">Suggested internal links</p><div className="mt-3 flex flex-wrap gap-2">{linkSuggestions.map(item=><button key={item.href} type="button" onClick={()=>patch("content",`${draft.content}\n\n[${item.label}](${item.href})`)} className="admin-btn-secondary">{item.label}</button>)}</div></div>}
        <section className="space-y-4 border-t border-white/10 pt-6"><div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-xs text-white/40">Find a gallery image<input value={imageQuery} onChange={e=>{setImageQuery(e.target.value);setVisibleImageCount(15);}} placeholder="Search any project, location, caption, or category" className={input}/></label><button type="button" onClick={surprise} disabled={!shownImages.length} className="admin-btn-secondary">Surprise me</button><label className="admin-btn-secondary cursor-pointer">Upload image<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" onChange={e=>{const file=e.target.files?.[0];if(file)upload(file);}}/></label></div><p className="text-xs text-white/35">{shownImages.length?`${shownImages.length} ${imageQuery?"matching ":"available "}image${shownImages.length===1?"":"s"} across ${new Set(shownImages.map(item=>item.projectId)).size} project${new Set(shownImages.map(item=>item.projectId)).size===1?"":"s"}`:"No gallery images match that search. Try a property, city, or media type."}</p>{imageUrl&&<div className="relative aspect-[16/7] overflow-hidden rounded-xl"><Image src={imageUrl} alt={draft.featuredImageAlt||"Article image"} fill className="object-cover"/></div>}<div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{shownImages.slice(0,visibleImageCount).map(item=><button key={item.id} type="button" title={`${item.property}${item.location?` · ${item.location}`:""} · ${item.categoryLabel}`} onClick={()=>{patch("featuredMediaId",item.id);patch("featuredImageStorageKey",null);patch("featuredImageUrl",null);patch("featuredImageAlt",item.alt);}} className={`relative aspect-[4/3] overflow-hidden rounded-lg border ${draft.featuredMediaId===item.id?"border-[var(--helios-orange)]":"border-white/10"}`}><Image src={item.url} alt={item.alt} fill className="object-cover"/></button>)}</div>{visibleImageCount<shownImages.length&&<div className="flex justify-center"><button type="button" onClick={()=>setVisibleImageCount(count=>Math.min(count+30,shownImages.length))} className="admin-btn-secondary">Show more images</button></div>}<label className="block text-xs text-white/40">Image alt text<input value={draft.featuredImageAlt||""} onChange={e=>patch("featuredImageAlt",e.target.value)} className={input}/></label></section>
        <details className="rounded-xl border border-white/[0.08] p-5"><summary className="cursor-pointer text-sm text-white/60">SEO, links, and social sharing</summary><div className="mt-5 space-y-4"><label className="block text-xs text-white/40">SEO title<input value={draft.seoTitle||""} onChange={e=>patch("seoTitle",e.target.value)} className={input}/></label><label className="block text-xs text-white/40">Meta description<textarea rows={3} value={draft.seoDescription||""} onChange={e=>patch("seoDescription",e.target.value)} className={input}/></label><label className="block text-xs text-white/40">Canonical URL<input value={draft.canonicalUrl||""} onChange={e=>patch("canonicalUrl",e.target.value)} placeholder="Leave blank to use this article URL" className={input}/></label><label className="block text-xs text-white/40">Source links — one URL per line<textarea rows={4} value={draft.sourceLinks.join("\n")} onChange={e=>patch("sourceLinks",e.target.value.split("\n").map(v=>v.trim()).filter(Boolean))} className={input}/></label><label className="block text-xs text-white/40">Social caption<textarea rows={4} value={draft.socialCaption||""} onChange={e=>patch("socialCaption",e.target.value)} className={input}/></label></div></details>
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]"><label className="text-xs text-white/40">Publishing status<select value={draft.status} onChange={e=>patch("status",e.target.value as Status)} className={input}><option value="DRAFT">Draft</option><option value="SCHEDULED">Scheduled</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label>{draft.status==="SCHEDULED"&&<label className="text-xs text-white/40">Publish date and time<input type="datetime-local" value={draft.scheduledAt?.slice(0,16)||""} onChange={e=>patch("scheduledAt",e.target.value?new Date(e.target.value).toISOString():null)} className={input}/></label>}</div>
        {message&&message!=="AI is writing…"&&<p role="status" className={`text-sm ${message.includes("could not")||message.includes("failed")?"text-red-300":"text-emerald-300"}`}>{message}</p>}
        <div className="flex flex-wrap items-center gap-3"><button disabled={busy} onClick={save} className="admin-btn-primary">{busy?"Working…":"Save article"}</button>{activeId&&<Link href={`/blog/${draft.slug}`} target="_blank" className="admin-btn-secondary">Preview ↗</Link>}{activeId&&<button disabled={busy} onClick={remove} className="admin-btn-destructive">Delete</button>}</div>
      </main>
    </div>
  </div>;
}
