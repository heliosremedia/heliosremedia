import { createFeedbackDraft, feedbackAdmin, feedbackErrorResponse, feedbackInput, feedbackResponse, loadFeedbackDashboard } from "@/lib/feedback-server";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return feedbackResponse(await loadFeedbackDashboard(await feedbackAdmin())); }
  catch (error) { return feedbackErrorResponse(error); }
}
export async function POST(request: Request) {
  try {
    const session = await feedbackAdmin(request);
    return feedbackResponse({ reminder: await createFeedbackDraft(session, await feedbackInput(request)) });
  } catch (error) { return feedbackErrorResponse(error); }
}
