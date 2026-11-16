/** Shared typography, extracted from Email Studio's navigation cards. */
const eyebrowClass = "text-xs uppercase tracking-[0.16em] text-[var(--helios-orange)]";
const titleClass = "text-xl font-light text-white";
const descriptionClass = "admin-card-description mt-2 text-sm text-white/45";

export default function AdminCardHeading({ eyebrow, title, description, inline = false }: {
  eyebrow?: string;
  title: string;
  description: string;
  /** Native summary only permits phrasing content (or a single heading). */
  inline?: boolean;
}) {
  const titleSpacing = eyebrow ? "mt-2 " : "";
  if (inline) return <>
    {eyebrow ? <span className={`block ${eyebrowClass}`}>{eyebrow}</span> : null}
    <span className={`block font-display ${titleSpacing}${titleClass}`}>{title}</span>
    <span className={`block ${descriptionClass}`}>{description}</span>
  </>;
  return <>
    {eyebrow ? <p className={eyebrowClass}>{eyebrow}</p> : null}
    <h2 className={`${titleSpacing}${titleClass}`}>{title}</h2>
    <p className={descriptionClass}>{description}</p>
  </>;
}
