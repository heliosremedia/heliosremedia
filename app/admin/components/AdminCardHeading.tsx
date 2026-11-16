/** Shared typography, extracted from Email Studio's navigation cards. */
const eyebrowClass = "text-xs uppercase tracking-[0.16em] text-[var(--helios-orange)]";
const titleClass = "text-xl font-light text-white";
const descriptionClass = "admin-card-description text-sm text-white/45";

export default function AdminCardHeading({ eyebrow, title, description, inline = false }: {
  eyebrow?: string;
  title: string;
  description: string;
  /** Native summary only permits phrasing content (or a single heading). */
  inline?: boolean;
}) {
  // Email Studio's h2/p margins are reset to zero by unlayered global CSS.
  // Apply that same effective spacing to phrasing-only summary spans too.
  const spacing = { margin: 0 };
  if (inline) return <>
    {eyebrow ? <span style={spacing} className={`block ${eyebrowClass}`}>{eyebrow}</span> : null}
    <span style={spacing} className={`block font-display ${titleClass}`}>{title}</span>
    <span style={spacing} className={`block ${descriptionClass}`}>{description}</span>
  </>;
  return <>
    {eyebrow ? <p style={spacing} className={eyebrowClass}>{eyebrow}</p> : null}
    <h2 style={spacing} className={titleClass}>{title}</h2>
    <p style={spacing} className={descriptionClass}>{description}</p>
  </>;
}
