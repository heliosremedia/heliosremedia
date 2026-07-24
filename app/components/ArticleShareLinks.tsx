"use client";

import { useState } from "react";

export default function ArticleShareLinks({ url, title }: { url: string; title: string }) {
  const [copied,setCopied]=useState(false);const share=encodeURIComponent(url);const heading=encodeURIComponent(title);
  return <div className="mt-4 flex flex-col items-start gap-2 text-sm text-white/45"><a target="_blank" rel="noopener noreferrer" href={`https://www.facebook.com/sharer/sharer.php?u=${share}`}>Facebook ↗</a><a target="_blank" rel="noopener noreferrer" href={`https://www.linkedin.com/sharing/share-offsite/?url=${share}`}>LinkedIn ↗</a><a target="_blank" rel="noopener noreferrer" href={`https://twitter.com/intent/tweet?url=${share}&text=${heading}`}>X ↗</a><a href={`mailto:?subject=${heading}&body=${share}`}>Email ↗</a><button type="button" onClick={async()=>{await navigator.clipboard.writeText(url);setCopied(true);setTimeout(()=>setCopied(false),1800);}}>{copied?"Link copied ✓":"Copy link"}</button></div>;
}
