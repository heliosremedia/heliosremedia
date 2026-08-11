import Link from "next/link";

type ProjectProgressCardProps = {
  number: string;
  label: string;
  detail: string;
  href: string;
  complete: boolean;
};

export default function ProjectProgressCard({
  number,
  label,
  detail,
  href,
  complete,
}: ProjectProgressCardProps) {
  return (
    <Link
      href={href}
      aria-label={`Open ${label}: ${detail}`}
      className={`group rounded-2xl border p-5 transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/70 ${
        complete
          ? "border-emerald-300/20 bg-emerald-300/[0.045] hover:border-emerald-300/35"
          : "border-white/[0.08] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.035]"
      }`}
    >
      <p className={`text-[0.6rem] font-semibold uppercase tracking-[0.18em] ${complete ? "text-emerald-200/70" : "text-white/25"}`}>
        Step {number}
      </p>
      <h2 className="mt-3 text-xl font-normal text-white transition group-hover:text-orange-100">{label}</h2>
      <p className="mt-2 text-xs text-white/30">{detail}</p>
    </Link>
  );
}
