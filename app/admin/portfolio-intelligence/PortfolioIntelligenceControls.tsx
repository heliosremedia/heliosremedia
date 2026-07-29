"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AnalyticsRange } from "@/lib/portfolio-analytics";

const ranges = ["7d", "30d", "90d"] as const;
const timeZone = "America/Denver";

function updatedLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export default function PortfolioIntelligenceControls({
  range,
  generatedAt,
}: {
  range: AnalyticsRange;
  generatedAt: string;
}) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(generatedAt);
  const [error, setError] = useState("");

  async function refreshData() {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch(
        `/admin/portfolio-intelligence?range=${range}`,
        {
          cache: "no-store",
          headers: { "x-helios-report-refresh": "manual" },
        },
      );
      if (!response.ok) {
        throw new Error("Portfolio Intelligence could not refresh.");
      }
      const completedAt = new Date().toISOString();
      router.refresh();
      setLastUpdated(completedAt);
    } catch {
      setError("Refresh failed. Existing reporting data remains visible.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {ranges.map((item) => (
          <Link
            key={item}
            href={`/admin/portfolio-intelligence?range=${item}`}
            aria-current={range === item ? "page" : undefined}
            className={
              range === item ? "admin-btn-primary" : "admin-btn-secondary"
            }
          >
            {item}
          </Link>
        ))}
        <button
          type="button"
          className="admin-btn-secondary"
          disabled={refreshing}
          aria-busy={refreshing}
          aria-describedby="portfolio-refresh-status"
          onClick={() => void refreshData()}
        >
          {refreshing ? "Refreshing…" : "Refresh Data"}
        </button>
      </div>
      <p
        id="portfolio-refresh-status"
        role="status"
        aria-live="polite"
        className={`text-[0.65rem] leading-5 ${error ? "text-amber-200/70" : "text-white/30"}`}
      >
        {error || `Last updated ${updatedLabel(lastUpdated)}`}
      </p>
    </div>
  );
}
