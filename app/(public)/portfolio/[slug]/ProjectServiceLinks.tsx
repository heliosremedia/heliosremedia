"use client";

type ProjectServiceLink = {
  id: string;
  name: string;
  destination: string;
};

export default function ProjectServiceLinks({
  links,
  overlay = false,
}: {
  links: ProjectServiceLink[];
  overlay?: boolean;
}) {
  if (links.length === 0) return null;

  return (
    <div className="mt-8 flex flex-wrap gap-2">
      {links.map((service) => (
        <a
          key={service.id}
          href={service.destination}
          aria-label={`View ${service.name} collection`}
          onClick={(event) => {
            const target = document.getElementById(
              service.destination.slice(1),
            );
            if (!target) return;
            event.preventDefault();
            target.focus({ preventScroll: true });
            target.scrollIntoView({
              block: "start",
              behavior: window.matchMedia(
                "(prefers-reduced-motion: reduce)",
              ).matches
                ? "auto"
                : "smooth",
            });
            window.history.replaceState(null, "", service.destination);
          }}
          className={`rounded-full border px-3.5 py-2 text-[0.52rem] font-semibold uppercase tracking-[0.15em] transition duration-300 hover:-translate-y-0.5 hover:border-[var(--helios-orange)]/65 hover:bg-[var(--helios-orange)]/10 hover:text-[var(--helios-orange)] focus-visible:border-[var(--helios-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)]/40 ${
            overlay
              ? "border-white/20 bg-black/20 text-white/70 backdrop-blur-md"
              : "border-white/15 text-white/55"
          }`}
        >
          {service.name}
        </a>
      ))}
    </div>
  );
}
