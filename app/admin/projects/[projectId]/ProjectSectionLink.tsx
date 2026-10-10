"use client";

import type { MouseEvent, ReactNode } from "react";

export default function ProjectSectionLink({ href, children, className, ariaLabel }: {
  href: `#${string}`;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  function openSection(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = document.getElementById(href.slice(1));
    if (!target) return;
    event.preventDefault();
    const toggle = target.querySelector<HTMLButtonElement>("button[aria-expanded]");
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    if (window.location.hash !== href) window.history.pushState(null, "", href);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!target.isConnected) return;
      const navigator = document.querySelector<HTMLElement>('nav[aria-label="Project Editor sections"]');
      const clearance = 80 + (navigator?.getBoundingClientRect().height ?? 80) + 16;
      window.scrollTo({
        top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - clearance),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
      target.focus({ preventScroll: true });
    }));
  }

  return <a href={href} aria-label={ariaLabel} className={className} onClick={openSection}>{children}</a>;
}
