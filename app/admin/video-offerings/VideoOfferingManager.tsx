"use client";

import { useState } from "react";

type Offering = {
  id: string;
  publicName: string;
  positioningStatement: string;
  publicDescription: string;
  offeringGroup: "CINEMATIC_FILM" | "SOCIAL_MEDIA_REEL";
  comparisonOrder: number;
  active: boolean;
  priceLabel: string | null;
  runtimeGuidance: string | null;
  orientation: string | null;
  bestForDescription: string | null;
  featureDistinctions: unknown;
  bookingDestination: string | null;
  eligibleExamples: number;
};

const input =
  "mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-4 text-sm text-white outline-none focus:border-[var(--helios-orange)]/60";

export default function VideoOfferingManager({
  initialOfferings,
}: {
  initialOfferings: Offering[];
}) {
  const [offerings, setOfferings] = useState(initialOfferings);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  async function save(offering: Offering) {
    setBusy(offering.id);
    setMessage("");
    const response = await fetch("/api/admin/video-offerings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(offering),
    });
    const data = await response.json();
    setBusy(null);
    setMessage(
      response.ok
        ? `${offering.publicName} saved.`
        : data.error || "Save failed.",
    );
  }
  const patch = (id: string, values: Partial<Offering>) =>
    setOfferings((current) =>
      current.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  return (
    <div className="space-y-5">
      <p role="status" className="min-h-5 text-sm text-white/45">
        {message}
      </p>
      {offerings.map((offering) => (
        <section
          key={offering.id}
          className="rounded-2xl border border-white/[.08] bg-[#111] p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow text-[var(--helios-orange)]">
                {offering.offeringGroup === "CINEMATIC_FILM"
                  ? "Cinematic film"
                  : "Social media reel"}
              </p>
              <h2 className="mt-2 text-2xl font-light text-white">
                {offering.publicName}
              </h2>
            </div>
            <div className="text-right">
              <p
                className={`text-xs ${offering.eligibleExamples ? "text-emerald-200/70" : "text-amber-200/70"}`}
              >
                {offering.eligibleExamples
                  ? `${offering.eligibleExamples} eligible example${offering.eligibleExamples === 1 ? "" : "s"}`
                  : "Warning: no eligible example"}
              </p>
              <label className="mt-3 flex items-center justify-end gap-2 text-sm text-white/50">
                <input
                  type="checkbox"
                  checked={offering.active}
                  onChange={(e) =>
                    patch(offering.id, { active: e.target.checked })
                  }
                />
                Active
              </label>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-white/40">
              Public name
              <input
                className={input}
                value={offering.publicName}
                onChange={(e) =>
                  patch(offering.id, { publicName: e.target.value })
                }
              />
            </label>
            <label className="text-xs text-white/40">
              Positioning statement
              <input
                className={input}
                value={offering.positioningStatement}
                onChange={(e) =>
                  patch(offering.id, { positioningStatement: e.target.value })
                }
              />
            </label>
            <label className="text-xs text-white/40 sm:col-span-2">
              Public description
              <textarea
                rows={4}
                className={`${input} py-3`}
                value={offering.publicDescription}
                onChange={(e) =>
                  patch(offering.id, { publicDescription: e.target.value })
                }
              />
            </label>
            <label className="text-xs text-white/40">
              Group
              <select
                className={input}
                value={offering.offeringGroup}
                onChange={(e) =>
                  patch(offering.id, {
                    offeringGroup: e.target.value as Offering["offeringGroup"],
                  })
                }
              >
                <option value="CINEMATIC_FILM">Cinematic Film</option>
                <option value="SOCIAL_MEDIA_REEL">Social Media Reel</option>
              </select>
            </label>
            <label className="text-xs text-white/40">
              Comparison order
              <input
                type="number"
                className={input}
                value={offering.comparisonOrder}
                onChange={(e) =>
                  patch(offering.id, {
                    comparisonOrder: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="text-xs text-white/40">
              Price label
              <input
                className={input}
                value={offering.priceLabel || ""}
                onChange={(e) =>
                  patch(offering.id, { priceLabel: e.target.value })
                }
              />
            </label>
            <label className="text-xs text-white/40">
              Runtime guidance
              <input
                className={input}
                value={offering.runtimeGuidance || ""}
                onChange={(e) =>
                  patch(offering.id, { runtimeGuidance: e.target.value })
                }
              />
            </label>
            <label className="text-xs text-white/40">
              Orientation
              <input
                className={input}
                value={offering.orientation || ""}
                onChange={(e) =>
                  patch(offering.id, { orientation: e.target.value })
                }
              />
            </label>
            <label className="text-xs text-white/40">
              Booking destination
              <input
                className={input}
                value={offering.bookingDestination || ""}
                onChange={(e) =>
                  patch(offering.id, { bookingDestination: e.target.value })
                }
              />
            </label>
            <label className="text-xs text-white/40 sm:col-span-2">
              Best suited for
              <textarea
                rows={2}
                className={`${input} py-3`}
                value={offering.bestForDescription || ""}
                onChange={(e) =>
                  patch(offering.id, { bestForDescription: e.target.value })
                }
              />
            </label>
            <label className="text-xs text-white/40 sm:col-span-2">
              Key distinctions, one per line
              <textarea
                rows={7}
                className={`${input} py-3`}
                value={
                  Array.isArray(offering.featureDistinctions)
                    ? offering.featureDistinctions.join("\n")
                    : ""
                }
                onChange={(e) =>
                  patch(offering.id, {
                    featureDistinctions: e.target.value
                      .split("\n")
                      .filter(Boolean),
                  })
                }
              />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button
              className="admin-btn-primary"
              disabled={busy === offering.id}
              onClick={() => void save(offering)}
            >
              {busy === offering.id ? "Saving…" : "Save offering"}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
