import { requireAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import EditionEditor from "../../components/EditionEditor";
import NewsletterAnalytics from "../../components/NewsletterAnalytics";
import DeliveryReviewPanel from "../../components/DeliveryReviewPanel";
export default async function EditionPage({ params }: { params: Promise<{ editionId: string }> }) { const session = await requireAdminSession(); if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/admin"); const { editionId } = await params; return <><EditionEditor editionId={editionId} /><DeliveryReviewPanel key={editionId} editionId={editionId} /><NewsletterAnalytics editionId={editionId} /></>; }
