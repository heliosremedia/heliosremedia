import { getSiteSettings } from "@/lib/site-settings";
import SiteSettingsForm from "./SiteSettingsForm";
export const dynamic = "force-dynamic";
export default async function SettingsPage() { return <div className="space-y-7"><section className="border-b border-white/[0.08] pb-7"><p className="eyebrow text-[var(--helios-orange)]">Platform identity</p><h1 className="mt-3 text-3xl font-light tracking-[-0.03em] text-white sm:text-4xl">Global site settings</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Control homepage media, business identity, contact destinations, service-area language, social profiles, footer content, and default search metadata used across Helios.</p></section><SiteSettingsForm initialSettings={await getSiteSettings()} /></div>; }
