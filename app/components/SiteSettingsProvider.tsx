"use client";
import { createContext, useContext } from "react";
import type { PublicSiteSettings } from "@/lib/site-settings";
import type { LocationPage } from "@/lib/location-pages";

type PublicSiteContext = {
  settings: PublicSiteSettings;
  locations: LocationPage[];
};

const SiteSettingsContext = createContext<PublicSiteContext | null>(null);
export function SiteSettingsProvider({ settings, locations, children }: { settings: PublicSiteSettings; locations: LocationPage[]; children: React.ReactNode }) { return <SiteSettingsContext.Provider value={{ settings, locations }}>{children}</SiteSettingsContext.Provider>; }
export function useSiteSettings() { const context = useContext(SiteSettingsContext); if (!context) throw new Error("SiteSettingsProvider is missing."); return context.settings; }
export function useLocationPages() { const context = useContext(SiteSettingsContext); if (!context) throw new Error("SiteSettingsProvider is missing."); return context.locations; }
