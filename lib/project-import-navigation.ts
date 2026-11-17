export function viewImportedProjectPhotos() {
  const section = document.getElementById("project-media");
  if (!section) return;
  const toggle = section.querySelector<HTMLButtonElement>("button[aria-expanded]");
  if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const target = document.getElementById("project-media-collections");
    if (!target) return;
    const nav = document.querySelector<HTMLElement>('nav[aria-label="Project steps"]');
    const clearance = 80 + (nav?.getBoundingClientRect().height ?? 0) + 16;
    window.scrollTo({ top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - clearance), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    target.focus({ preventScroll: true });
  }));
}
