type AdminSection = {
  href: `#${string}`;
  label: string;
};

export default function AdminSectionNavigator({
  label,
  sections,
}: {
  label: string;
  sections: readonly AdminSection[];
}) {
  return (
    <nav
      aria-label={label}
      className="sticky top-3 z-30 overflow-x-auto rounded-2xl border border-white/10 bg-[#151515]/95 p-3 shadow-xl backdrop-blur"
    >
      <div className="flex min-w-max gap-2">
        {sections.map((section) => (
          <a
            key={section.href}
            href={section.href}
            className="admin-btn-secondary whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--helios-orange)]"
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
