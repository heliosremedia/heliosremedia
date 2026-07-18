"use client";
import { createContext, useContext } from "react";
import type { PublicSiteSettings } from "@/lib/site-settings";

const SiteSettingsContext = createContext<PublicSiteSettings | null>(null);
export function SiteSettingsProvider({ settings, children }: { settings: PublicSiteSettings; children: React.ReactNode }) { return <SiteSettingsContext.Provider value={settings}>{children}</SiteSettingsContext.Provider>; }
export function useSiteSettings() { const settings = useContext(SiteSettingsContext); if (!settings) throw new Error("SiteSettingsProvider is missing."); return settings; }
