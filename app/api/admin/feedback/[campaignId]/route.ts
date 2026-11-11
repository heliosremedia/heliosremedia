import { changeFeedbackReminder, feedbackAdmin, feedbackErrorResponse, feedbackInput, feedbackResponse } from "@/lib/feedback-server";
export async function PATCH(request: Request, context: { params: Promise<{ campaignId: string }> }) {
  try {
    const session = await feedbackAdmin(request);
    const { campaignId } = await context.params;
    return feedbackResponse({ reminder: await changeFeedbackReminder(session, campaignId, await feedbackInput(request)) });
  } catch (error) { return feedbackErrorResponse(error); }
}
