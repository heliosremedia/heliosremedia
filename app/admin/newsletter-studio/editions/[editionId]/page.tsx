import { requireNewsletterAdministrator } from "@/lib/newsletters/api";
import { redirect } from "next/navigation";
import EditionEditor from "../../components/EditionEditor";
import NewsletterAnalytics from "../../components/NewsletterAnalytics";
import DeliveryReviewPanel from "../../components/DeliveryReviewPanel";
import GenerationRecoveryPanel from "../../components/GenerationRecoveryPanel";

export default async function EditionPage({ params }: { params: Promise<{ editionId: string }> }) {
  const session = await requireNewsletterAdministrator();
  if (!session) redirect("/admin");
  const { editionId } = await params;
  return <>
    <EditionEditor editionId={editionId} />
    <GenerationRecoveryPanel key={`generation-${editionId}`} editionId={editionId} />
    <DeliveryReviewPanel key={editionId} editionId={editionId} />
    <NewsletterAnalytics editionId={editionId} actor={{ userId: session.userId, workspaceId: session.workspaceId, sessionVersion: session.sessionVersion }} />
  </>;
}
