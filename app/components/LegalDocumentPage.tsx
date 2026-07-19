import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import type { ManagedLegalDocument } from "@/lib/legal-documents";

function LegalBody({ content }: { content: string }) {
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
      <article className="max-w-4xl text-[0.98rem] leading-8 text-white/60 sm:text-base"><LegalBody content={document.content} /></article>
    </section>
    <Footer />
  </main>;
}
