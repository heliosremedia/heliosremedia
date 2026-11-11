import { feedbackAdmin, feedbackErrorResponse, feedbackInput, feedbackResponse, previewFeedback } from "@/lib/feedback-server";
export async function POST(request: Request) {
  try {
    await feedbackAdmin(request);
    return feedbackResponse(previewFeedback(await feedbackInput(request)));
  } catch (error) { return feedbackErrorResponse(error); }
}
