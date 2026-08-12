"use client";

import { useEffect, useState } from "react";

type Offering = { id: string; publicName: string; offeringGroup: string };
type Placement = {
  offeringId: string;
  showOnComparison: boolean;
  featuredExample: boolean;
  comparisonOrder: number;
  publicTitle: string | null;
  posterOverrideUrl: string | null;
};
type Video = {
  id: string;
  originalFilename: string | null;
  externalUrl: string | null;
  visibility: string;
  provider: string | null;
  comparisonPlacement: Placement | null;
};
const field =
  "mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm text-white outline-none focus:border-[var(--helios-orange)]/60";

export default function FilmComparisonClassifier({
  projectId,
  projectStatus,
}: {
  projectId: string;
  projectStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
}) {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    void fetch(`/api/admin/projects/${projectId}/film-comparison`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setOfferings(data.offerings);
          setVideos(data.media);
        }
      });
  }, [projectId]);
  const patch = (id: string, values: Partial<Placement>) =>
    setVideos((current) =>
      current.map((video) =>
        video.id === id
          ? {
              ...video,
              comparisonPlacement: {
                offeringId: "",
                showOnComparison: false,
                featuredExample: false,
                comparisonOrder: 0,
                publicTitle: null,
                posterOverrideUrl: null,
                ...video.comparisonPlacement,
                ...values,
              },
            }
          : video,
      ),
    );
  async function save(video: Video) {
    setBusy(video.id);
    setMessage("");
    const response = await fetch(
      `/api/admin/projects/${projectId}/film-comparison`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaId: video.id,
          ...video.comparisonPlacement,
        }),
      },
    );
    const data = await response.json();
    setBusy(null);
    setMessage(
      response.ok
        ? "Film comparison classification saved."
        : data.error || "Save failed.",
    );
    if (response.ok)
      setVideos((current) =>
        current.map((item) =>
          item.id === video.id
            ? { ...item, comparisonPlacement: data.placement }
            : data.placement?.featuredExample &&
                item.comparisonPlacement?.offeringId ===
                  data.placement.offeringId
              ? {
                  ...item,
                  comparisonPlacement: {
                    ...item.comparisonPlacement,
                    featuredExample: false,
                  },
                }
              : item,
        ),
      );
  }
  if (!videos.length) return null;
  return (
    <section className="mt-7 rounded-2xl border border-[var(--helios-orange)]/20 bg-[var(--helios-orange)]/[.025] p-5 sm:p-7">
      <div>
        <p className="eyebrow text-[var(--helios-orange)]">Film Comparison</p>
        <h3 className="mt-2 text-2xl font-light text-white">
          Classify playable video assets
        </h3>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">
          Classification controls only the comparison page. It never moves,
          duplicates, republishes, or changes the underlying video.
        </p>
      </div>
      <p role="status" className="mt-4 min-h-5 text-sm text-white/45">
        {message}
      </p>
      {projectStatus !== "PUBLISHED" && (
        <div
          role="note"
          className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[.06] px-4 py-3 text-sm leading-6 text-amber-100/75"
        >
          This project is {projectStatus.toLowerCase()}. Its classifications are
          saved, but its videos cannot appear on the public Film Comparison page
          until the project is published.
        </div>
      )}
      <div className="mt-3 space-y-4">
        {videos.map((video) => {
          const placement = video.comparisonPlacement;
          return (
            <article
              key={video.id}
              className="rounded-xl border border-white/[.08] bg-black/20 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm text-white/75">
                    {video.originalFilename || "Untitled video"}
                  </h4>
                  <p className="mt-1 text-xs text-white/30">
                    {video.provider || "Hosted video"} ·{" "}
                    {video.visibility.toLowerCase()}
                  </p>
                </div>
                {video.visibility !== "VISIBLE" && (
                  <span className="text-xs text-amber-200/70">
                    Hidden videos remain publicly ineligible
                  </span>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-xs text-white/40">
                  Video offering
                  <select
                    className={field}
                    value={placement?.offeringId || ""}
                    onChange={(e) =>
                      patch(video.id, {
                        offeringId: e.target.value,
                        showOnComparison: e.target.value
                          ? (placement?.showOnComparison ?? false)
                          : false,
                        featuredExample: e.target.value
                          ? (placement?.featuredExample ?? false)
                          : false,
                      })
                    }
                  >
                    <option value="">Not classified</option>
                    {offerings.map((offering) => (
                      <option key={offering.id} value={offering.id}>
                        {offering.publicName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-white/40">
                  Additional example order
                  <input
                    type="number"
                    className={field}
                    value={placement?.comparisonOrder ?? 0}
                    onChange={(e) =>
                      patch(video.id, {
                        comparisonOrder: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="text-xs text-white/40">
                  Public comparison title
                  <input
                    className={field}
                    value={placement?.publicTitle || ""}
                    onChange={(e) =>
                      patch(video.id, { publicTitle: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-5">
                <label className="flex items-center gap-2 text-sm text-white/55">
                  <input
                    type="checkbox"
                    disabled={!placement?.offeringId}
                    checked={placement?.showOnComparison ?? false}
                    onChange={(e) =>
                      patch(video.id, { showOnComparison: e.target.checked })
                    }
                  />
                  Show on Film Comparison
                </label>
                <label className="flex items-center gap-2 text-sm text-white/55">
                  <input
                    type="checkbox"
                    disabled={!placement?.offeringId}
                    checked={placement?.featuredExample ?? false}
                    onChange={(e) =>
                      patch(video.id, { featuredExample: e.target.checked })
                    }
                  />
                  Featured example
                </label>
                <button
                  className="admin-btn-secondary sm:ml-auto"
                  disabled={busy === video.id}
                  onClick={() => void save(video)}
                >
                  {busy === video.id ? "Saving…" : "Save classification"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
