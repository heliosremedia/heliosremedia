"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const EXIT_MS = 140;

function isModifiedClick(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export default function PublicRouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(true);
  const navigatingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    navigatingRef.current = false;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;

    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    setVisible(false);
    const frame = window.requestAnimationFrame(() => {
      setVisible(true);
      const main = document.querySelector<HTMLElement>("main");
      if (main) {
        const hadTabIndex = main.hasAttribute("tabindex");
        if (!hadTabIndex) main.setAttribute("tabindex", "-1");
        main.focus({ preventScroll: true });
        if (!hadTabIndex) main.addEventListener("blur", () => main.removeAttribute("tabindex"), { once: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (isModifiedClick(event)) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target || target.hasAttribute("download")) return;

      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/admin")) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      event.preventDefault();
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      window.dispatchEvent(new CustomEvent("helios:public-navigation-start"));

      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reducedMotion) {
        router.push(`${url.pathname}${url.search}${url.hash}`);
        return;
      }

      setVisible(false);
      timerRef.current = window.setTimeout(() => {
        router.push(`${url.pathname}${url.search}${url.hash}`);
      }, EXIT_MS);
    };

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      navigatingRef.current = false;
    };
  }, [router]);

  return (
    <div
      data-public-route-transition
      data-route-visible={visible ? "true" : "false"}
      className={`min-h-svh bg-[var(--background)] transition-opacity duration-200 ease-out motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-[0.72]"}`}
    >
      {children}
    </div>
  );
}
