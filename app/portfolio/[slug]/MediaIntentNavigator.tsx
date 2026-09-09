"use client";

import { useEffect } from "react";

export default function MediaIntentNavigator({ projectId }: { projectId: string }) {
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const source = new URLSearchParams(window.location.search).get("from");
    if (!hash || !source) return;
    const destination = document.getElementById(hash);
    if (!destination) {
      history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}`);
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    const headingId = destination.getAttribute("aria-labelledby");
    const heading = headingId ? document.getElementById(headingId) : destination.querySelector<HTMLElement>("h1,h2,h3");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.requestAnimationFrame(() => {
      destination.scrollIntoView({ block: "start", behavior: reducedMotion ? "auto" : "smooth" });
      heading?.focus({ preventScroll: true });
      window.dispatchEvent(new CustomEvent("helios:portfolio-analytics", { detail: {
        eventName: "PROJECT_VIEW", projectId, channel: "portfolio",
        target: `#${hash}`, metadata: { label: source }, onceKey: `media-intent:${projectId}:${source}`,
      } }));
    });
  }, [projectId]);
  return null;
}
