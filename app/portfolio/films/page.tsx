import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import PortfolioAnalytics from "@/app/components/PortfolioAnalytics";
import { getDiscoveryFilms } from "@/lib/portfolio-discovery";
import { getPublicWorkspaceId } from "@/lib/public-workspace";
import { buildPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import { getPortfolioDiscoverySettings } from "@/lib/portfolio-discovery-settings";
import FilmsBrowser from "./FilmsBrowser";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const settings = await getSiteSettings(); return buildPageMetadata({ title: "Real Estate Film Gallery | Helios", description: "Watch published Helios cinematic films, agent branding, AI cinematic films, vertical reels, and social content.", path: "/portfolio/films", settings }); }
export default async function FilmsPage() { const workspaceId = await getPublicWorkspaceId(); const settings = await getPortfolioDiscoverySettings(workspaceId); if (!settings.filmEnabled) notFound(); const result = await getDiscoveryFilms({ workspaceId, mode: settings.filmOrderingMode, excludedProjectIds: settings.excludedProjectIds, excludedMediaIds: settings.excludedMediaIds, offset: 0, count: settings.initialItemCount }); return <main className="min-h-screen bg-[var(--background)] text-white"><Navbar variant="solid"/><PortfolioAnalytics page="portfolio"/><section className="container-shell pb-24 pt-28 sm:pb-32 sm:pt-32"><Link href="/portfolio" className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-white/40 hover:text-white">← Portfolio</Link><div className="mt-7 border-b border-white/[0.08] pb-6"><p className="eyebrow text-[var(--helios-orange)]">Quick Browse</p><h1 className="mt-4 max-w-4xl font-display text-[clamp(3rem,6vw,5.5rem)] font-light leading-[0.94] tracking-[-0.045em]">All Films</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-white/42">Watch published Helios films across cinematic, branding, AI, vertical, and social collections.</p><p className="mt-2 text-xs text-white/28">{result.total} films</p></div><FilmsBrowser initialItems={result.items} initialNextOffset={result.nextOffset} total={result.total}/></section><Footer/></main>; }
