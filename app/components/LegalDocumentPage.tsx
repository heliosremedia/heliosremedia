import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import type { ManagedLegalDocument } from "@/lib/legal-documents";
import { containsHtml, sanitizeLegalHtml } from "@/lib/legal-html";

function LegalBody({ content }: { content: string }) {
  if (containsHtml(content)) {
    return (
      <div
        className="legal-html"
        dangerouslySetInnerHTML={{ __html: sanitizeLegalHtml(content) }}
      />
    );
  }

  const blocks = content.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

  return <div className="space-y-7">{blocks.map((block, index) => {
    if (block.startsWith("### ")) return <h3 key={index} className="pt-3 font-display text-2xl font-light text-white/90">{block.slice(4)}</h3>;
    if (block.startsWith("## ")) return <h2 key={index} className="pt-5 font-display text-3xl font-light text-white">{block.slice(3)}</h2>;
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.every((line) => line.startsWith("- "))) return <ul key={index} className="list-disc space-y-3 pl-6">{lines.map((line, itemIndex) => <li key={itemIndex}>{line.slice(2)}</li>)}</ul>;
    if (lines.every((line) => /^\d+\.\s/.test(line))) return <ol key={index} className="list-decimal space-y-3 pl-6">{lines.map((line, itemIndex) => <li key={itemIndex}>{line.replace(/^\d+\.\s/, "")}</li>)}</ol>;
    return <p key={index} className="whitespace-pre-line">{block}</p>;
  })}</div>;
}

export default function LegalDocumentPage({ document }: { document: ManagedLegalDocument }) {
  return <main className="min-h-screen bg-[var(--background)] text-white">
    <Navbar variant="solid" />
    <section className="relative overflow-hidden border-b border-white/[0.07]">
      <div className="pointer-events-none absolute right-[-12rem] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-[rgba(217,107,43,0.08)] blur-[150px]" />
      <div className="container-shell relative py-20 sm:py-24 lg:py-28">
        <p className="eyebrow text-[var(--helios-orange)]">Legal information</p>
        <h1 className="mt-5 max-w-4xl font-display text-[clamp(3.5rem,7vw,7rem)] font-light leading-[0.92] tracking-[-0.045em]">{document.title}</h1>
        <p className="mt-7 text-xs uppercase tracking-[0.2em] text-white/30">Last updated {document.updatedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      </div>
    </section>
    <section className="container-shell py-16 sm:py-20 lg:py-24">
      <article className="max-w-4xl text-[0.98rem] leading-8 text-white/60 sm:text-base [&_.legal-html]:space-y-6 [&_.legal-html_a]:text-[var(--helios-orange)] [&_.legal-html_a]:underline [&_.legal-html_a]:underline-offset-4 [&_.legal-html_blockquote]:border-l-2 [&_.legal-html_blockquote]:border-[var(--helios-orange)]/45 [&_.legal-html_blockquote]:pl-6 [&_.legal-html_h1]:pt-4 [&_.legal-html_h1]:font-display [&_.legal-html_h1]:text-4xl [&_.legal-html_h1]:font-light [&_.legal-html_h1]:leading-tight [&_.legal-html_h1]:text-white [&_.legal-html_h2]:pt-8 [&_.legal-html_h2]:font-display [&_.legal-html_h2]:text-3xl [&_.legal-html_h2]:font-light [&_.legal-html_h2]:leading-tight [&_.legal-html_h2]:text-white [&_.legal-html_h3]:pt-5 [&_.legal-html_h3]:font-display [&_.legal-html_h3]:text-2xl [&_.legal-html_h3]:font-light [&_.legal-html_h3]:leading-tight [&_.legal-html_h3]:text-white/90 [&_.legal-html_h4]:pt-4 [&_.legal-html_h4]:font-semibold [&_.legal-html_h4]:text-white/85 [&_.legal-html_hr]:my-10 [&_.legal-html_hr]:border-white/10 [&_.legal-html_li]:pl-1 [&_.legal-html_ol]:list-decimal [&_.legal-html_ol]:space-y-3 [&_.legal-html_ol]:pl-7 [&_.legal-html_p]:my-5 [&_.legal-html_strong]:font-semibold [&_.legal-html_strong]:text-white/85 [&_.legal-html_table]:my-8 [&_.legal-html_table]:w-full [&_.legal-html_table]:border-collapse [&_.legal-html_td]:border [&_.legal-html_td]:border-white/10 [&_.legal-html_td]:p-3 [&_.legal-html_th]:border [&_.legal-html_th]:border-white/10 [&_.legal-html_th]:p-3 [&_.legal-html_th]:text-left [&_.legal-html_th]:text-white/85 [&_.legal-html_ul]:list-disc [&_.legal-html_ul]:space-y-3 [&_.legal-html_ul]:pl-7"><LegalBody content={document.content} /></article>
    </section>
    <Footer />
  </main>;
}
