export type PhotoImportProgressValue = { total: number; done: number; state: "running" | "stopped" | "complete" };
export default function PhotoImportProgress({ value }: { value: PhotoImportProgressValue }) {
  const done = Math.min(value.total, Math.max(0, value.done));
  // Floor avoids displaying 100% until the final server response is received.
  const percent = value.total > 0 ? Math.floor(done / value.total * 100) : 0;
  const label = `${done} of ${value.total} selected photos ready`;
  return <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/20 p-4">
    <div className="flex items-center justify-between gap-3 text-sm"><span className="text-white/70">{value.state === "stopped" ? "Import stopped" : value.state === "complete" ? "Photos ready" : "Importing photos"}</span><span className="tabular-nums text-white/70">{percent}%</span></div>
    <div role="progressbar" aria-label="Selected photo import" aria-valuemin={0} aria-valuemax={value.total} aria-valuenow={done} aria-valuetext={label} className="h-2.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none ${value.state === "complete" ? "bg-emerald-400" : "bg-[var(--helios-orange)]"}`} style={{ width: `${percent}%` }} /></div>
    <p className="text-xs text-white/50">{label}. {value.state === "stopped" ? "Ready photos are kept. Retry the remaining selection to continue." : "Progress advances after each photo is confirmed, not by file size."}</p>
  </div>;
}
