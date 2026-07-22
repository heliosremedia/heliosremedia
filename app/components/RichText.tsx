import { sanitizeRichText } from "@/lib/rich-text";

export default function RichText({ content, className = "" }: { content: string; className?: string }) {
  return (
    <div
      className={`whitespace-pre-line [&_a]:text-[var(--helios-orange)] [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--helios-orange)]/60 [&_blockquote]:pl-5 [&_li]:ml-5 [&_li]:pl-1 [&_ol]:list-decimal [&_p+p]:mt-4 [&_ul]:list-disc ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitizeRichText(content) }}
    />
  );
}
