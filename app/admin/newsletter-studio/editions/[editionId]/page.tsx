import { requireAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import EditionEditor from "../../components/EditionEditor";
import NewsletterAnalytics from "../../components/NewsletterAnalytics";
export default async function EditionPage({ params }: { params: Promise<{ editionId: string }> }) { const session = await requireAdminSession(); if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin"); const { editionId } = await params; return <><EditionEditor editionId={editionId} /><NewsletterAnalytics editionId={editionId} /></>; }
