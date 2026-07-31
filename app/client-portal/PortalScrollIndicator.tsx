"use client";

export default function PortalScrollIndicator() {
  function viewOptions() {
    const target = document.getElementById("portal-options");
    if (!target) return;
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
    window.setTimeout(() => target.focus({ preventScroll: true }), 350);
  }

  return (
    <button
      type="button"
      onClick={viewOptions}
      aria-label="View portal options"
      className="portal-scroll-indicator group absolute bottom-4 left-1/2 z-10 flex min-h-11 -translate-x-1/2 flex-col items-center justify-center rounded-xl px-4 text-[var(--helios-orange)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--helios-orange)] focus-visible:ring-offset-4 focus-visible:ring-offset-[#090909] sm:bottom-6"
    >
      <span className="text-[0.55rem] font-semibold uppercase tracking-[0.17em] text-white/55 transition-colors group-hover:text-white">
        Choose Your Portal
      </span>
      <span aria-hidden="true" className="portal-scroll-arrow mt-1 text-xl leading-none">↓</span>
    </button>
  );
}
