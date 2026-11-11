import { feedbackAdmin, feedbackErrorResponse, feedbackInput, feedbackResponse, testFeedback } from "@/lib/feedback-server";
export async function POST(request: Request) {
  try {
    const session = await feedbackAdmin(request);
    return feedbackResponse(await testFeedback(session, await feedbackInput(request)));
  } catch (error) { return feedbackErrorResponse(error); }
}
