export type AdminSummary = {
  label: string;
  value: number | string | null;
  detail?: string;
  tone?: "neutral" | "good" | "warning" | "critical";
};

const tones = {
  neutral: "border-white/[0.08] text-white",
  good: "border-emerald-400/20 text-emerald-200",
  warning: "border-amber-300/20 text-amber-100",
  critical: "border-red-400/20 text-red-200",
};

export default function AdminSummaryCards({ items, label = "Module summary" }: { items: AdminSummary[]; label?: string }) {
  return <section aria-label={label} className="admin-summary-dashboard grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {items.map(item => <article key={item.label} className={`min-w-0 rounded-2xl border bg-white/[0.025] p-5 ${tones[item.tone || "neutral"]}`}>
      <p className="text-[0.54rem] font-semibold uppercase tracking-[0.17em] text-white/30">{item.label}</p>
      <p className="mt-3 text-3xl font-light tracking-[-0.04em]">{item.value === null ? "Unavailable" : item.value}</p>
      {item.detail&&<p className="mt-2 text-xs leading-5 text-white/30">{item.detail}</p>}
    </article>)}
  </section>;
}
