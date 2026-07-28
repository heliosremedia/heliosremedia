"use client";

import { useEffect } from "react";
import type { PortfolioEventName } from "@/lib/portfolio-analytics-core";

type Detail = {
  eventName: PortfolioEventName;
  projectId?: string;
  channel?: string;
  target?: string;
  metadata?: Record<string, string | number | boolean>;
  onceKey?: string;
};

function sessionId() {
  const key = "helios-portfolio-session";
  let value = window.sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID().replaceAll("-", "");
    window.sessionStorage.setItem(key, value);
  }
  return value;
}

function safeEventId(eventName: PortfolioEventName) {
  return `${eventName.toLowerCase()}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function sendPortfolioEvent(detail: Detail) {
  try {
    const onceKey = detail.onceKey ? `helios-analytics:${detail.onceKey}` : null;
    if (onceKey && window.sessionStorage.getItem(onceKey)) return;
    const body = JSON.stringify({
      ...detail,
      onceKey: undefined,
      eventId: safeEventId(detail.eventName),
      sessionId: sessionId(),
    });
    const deliver = (attempt = 0): Promise<void> => fetch("/api/portfolio-analytics", {
        method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true,
      }).then(async response => {
        const result = response.ok
          ? await response.json().catch(() => null) as { state?: string; stored?: boolean } | null
          : null;
        if (result?.state === "stored" && result.stored) {
          if (onceKey) window.sessionStorage.setItem(onceKey, "1");
          return;
        }
        if (attempt < 2) {
          await new Promise(resolve => window.setTimeout(resolve, 400 * (attempt + 1)));
          return deliver(attempt + 1);
        }
      }).catch(async () => {
        if (attempt < 2) {
          await new Promise(resolve => window.setTimeout(resolve, 400 * (attempt + 1)));
          return deliver(attempt + 1);
        }
      });
    void deliver();
  } catch {
    // Measurement must never block the public experience.
  }
}

export default function PortfolioAnalytics({
  page, projectId,
}: { page: "portfolio" | "project"; projectId?: string }) {
  useEffect(() => {
    sendPortfolioEvent({
      eventName: page === "portfolio" ? "PORTFOLIO_VIEW" : "PROJECT_VIEW",
      projectId,
      onceKey: `${page}:${projectId || "index"}`,
    });
    function eventHandler(event: Event) {
      const detail = (event as CustomEvent<Detail>).detail;
      if (detail?.eventName) sendPortfolioEvent({ ...detail, projectId: detail.projectId || projectId });
    }
    window.addEventListener("helios:portfolio-analytics", eventHandler);
    function clickHandler(event: MouseEvent) {
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-analytics-event],a[target='_blank']");
      if (!element) return;
      const declared = element.dataset.analyticsEvent as PortfolioEventName | undefined;
      const anchor = element instanceof HTMLAnchorElement ? element : element.closest("a");
      const eventName = declared || (anchor ? "OUTBOUND_LINK_CLICK" : undefined);
      if (!eventName) return;
      sendPortfolioEvent({
        eventName,
        projectId: element.dataset.analyticsProject || projectId,
        channel: element.dataset.analyticsChannel,
        target: element.dataset.analyticsTarget || anchor?.href,
        metadata: element.dataset.analyticsLabel ? { label: element.dataset.analyticsLabel } : undefined,
      });
    }
    document.addEventListener("click", clickHandler, { capture: true });
    return () => {
      window.removeEventListener("helios:portfolio-analytics", eventHandler);
      document.removeEventListener("click", clickHandler, { capture: true });
    };
  }, [page, projectId]);
  return null;
}
