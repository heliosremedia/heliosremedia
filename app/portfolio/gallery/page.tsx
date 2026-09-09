import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Footer from "@/app/components/Footer";
import Navbar from "@/app/components/Navbar";
import PortfolioAnalytics from "@/app/components/PortfolioAnalytics";
import { getDiscoveryPhotos } from "@/lib/portfolio-discovery";
import { getPublicWorkspaceId } from "@/lib/public-workspace";
import { buildPageMetadata } from "@/lib/seo";
import { getSiteSettings } from "@/lib/site-settings";
import { getPortfolioDiscoverySettings } from "@/lib/portfolio-discovery-settings";
import PhotographyBrowser from "./PhotographyBrowser";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> { const settings = await getSiteSettings(); return buildPageMetadata({ title: "Real Estate Photography Gallery | Helios", description: "Browse a curated masonry gallery of published Helios real estate photography across Northern Colorado.", path: "/portfolio/gallery", settings }); }

export default async function PhotographyGalleryPage() {
  const workspaceId = await getPublicWorkspaceId();
  const settings = await getPortfolioDiscoverySettings(workspaceId);
  if (!settings.photoEnabled) notFound();
  const result = await getDiscoveryPhotos({ workspaceId, mode: settings.photoOrderingMode, excludedProjectIds: settings.excludedProjectIds, excludedMediaIds: settings.excludedMediaIds, offset: 0, count: settings.initialItemCount });
  return <main className="min-h-screen bg-[var(--background)] text-white"><Navbar variant="solid"/><PortfolioAnalytics page="portfolio"/><section className="container-shell pb-24 pt-28 sm:pb-32 sm:pt-36"><Link href="/portfolio" className="text-[0.56rem] font-semibold uppercase tracking-[0.16em] text-white/40 hover:text-white">← Portfolio</Link><div className="mt-8 border-b border-white/[0.08] pb-8"><p className="eyebrow text-[var(--helios-orange)]">Quick Browse</p><h1 className="mt-4 max-w-4xl font-display text-[clamp(3.2rem,7vw,6.5rem)] font-light leading-[0.9] tracking-[-0.05em]">All Photography</h1><p className="mt-6 max-w-2xl text-sm leading-7 text-white/42">A broad look at published Helios photography, arranged as a balanced editorial collection.</p><p className="mt-4 text-xs text-white/28">{result.total} photographs</p></div><PhotographyBrowser initialItems={result.items} initialNextOffset={result.nextOffset} total={result.total}/></section><Footer/></main>;
}
