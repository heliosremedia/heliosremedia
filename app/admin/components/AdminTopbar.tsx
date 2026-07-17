import Link from "next/link";

type AdminTopbarProps = {
  onMenuOpen: () => void;
};

export default function AdminTopbar({
  onMenuOpen,
}: AdminTopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-white/[0.08] bg-[#09090a]/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuOpen}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:border-white/20 hover:text-white lg:hidden"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5"
          >
            <path
              d="M5 8h14M5 16h14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div>
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-white/30">
            Helios Real Estate Media
          </p>

          <p className="mt-1 text-sm text-white/65">
            Portfolio workspace
          </p>
        </div>
      </div>

      <Link
        href="/admin/projects/new"
        className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--helios-orange)] px-5 text-xs font-semibold uppercase tracking-[0.16em] text-white transition duration-300 hover:bg-[var(--helios-orange-hover)]"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          className="h-4 w-4"
        >
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        <span className="hidden sm:inline">New Project</span>
        <span className="sm:hidden">New</span>
      </Link>
    </header>
  );
}