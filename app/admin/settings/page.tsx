import { AdminPageHeader } from "@/app/admin/components/AdminPageLayout";
import { getSiteSettings } from "@/lib/site-settings";
import SiteSettingsForm from "./SiteSettingsForm";
import LegalDocumentsManager from "./LegalDocumentsManager";
import { getLegalDocuments } from "@/lib/legal-documents";
import FaviconManager from "./FaviconManager";
export const dynamic = "force-dynamic";
export default async function SettingsPage() { const [settings, legalDocuments] = await Promise.all([getSiteSettings(), getLegalDocuments()]); return <div className="space-y-7"><AdminPageHeader eyebrow="Platform identity" title="Global site settings" description="Control business identity, contact destinations, service-area language, social profiles, footer content, legal publishing, and default search metadata used across Helios." /><SiteSettingsForm initialSettings={settings} brandIdentityAddon={<FaviconManager initialSettings={settings} />} legalAddon={<LegalDocumentsManager initialDocuments={legalDocuments.map((document) => ({ ...document, updatedAt: document.updatedAt.toISOString() }))} />} /></div>; }
