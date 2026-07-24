import Link from "next/link";

function inline(value: string) {
  const parts = value.split(/(\[[^\]]+\]\(https?:\/\/[^)]+\)|\[[^\]]+\]\(\/[^)]+\)|\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) return <Link key={index} href={link[2]} className="text-[var(--helios-orange)] underline decoration-white/15 underline-offset-4">{link[1]}</Link>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-semibold text-white/80">{part.slice(2,-2)}</strong>;
    return part;
  });
}

export default function BlogArticleBody({ content }: { content: string }) {
  return <div className="blog-article-body">{content.split(/\n+/).map((line,index)=>{
    const value=line.trim();if(!value)return null;
    if(value.startsWith("### "))return <h3 key={index}>{inline(value.slice(4))}</h3>;
    if(value.startsWith("## "))return <h2 key={index}>{inline(value.slice(3))}</h2>;
    if(value.startsWith("# "))return <h2 key={index}>{inline(value.slice(2))}</h2>;
    if(/^[-*] /.test(value))return <p key={index} className="blog-list-item">• {inline(value.slice(2))}</p>;
    return <p key={index}>{inline(value)}</p>;
  })}</div>;
}
