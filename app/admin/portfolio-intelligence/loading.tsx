export default function Loading() {
  return <div className="space-y-6" aria-busy="true" aria-label="Loading Portfolio Intelligence"><div className="h-32 animate-pulse rounded-2xl bg-white/[0.04]"/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({length:4},(_,index)=><div key={index} className="h-32 animate-pulse rounded-2xl bg-white/[0.04]"/>)}</div></div>;
}
