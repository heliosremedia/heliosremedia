import { NextResponse } from "next/server";
import { eventAdmin } from "@/lib/events/service";
import { eventAIConfiguration, eventAIInput, generateEventEmails, readEventAIBody, reserveEventAIGeneration } from "@/lib/events/ai";
import { EventAIError } from "@/lib/events/ai-contract";

export const maxDuration = 75;
const headers = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let userId: string;
  try { userId = (await eventAdmin()).userId; }
  catch (error) {
    const forbidden = error instanceof Error && error.message === "Administrator access required.";
    return NextResponse.json({ success: false, error: forbidden ? "Administrator access required." : "AI writing is temporarily unavailable." }, { status: forbidden ? 403 : 503, headers });
  }
  try {
    const input = eventAIInput(await readEventAIBody(request));
    eventAIConfiguration();
    if (request.signal.aborted) throw new EventAIError("timeout");
    await reserveEventAIGeneration(userId);
    const draft = await generateEventEmails(input, request.signal);
    return NextResponse.json({ success: true, draft }, { headers });
  } catch (error) {
    const safe = error instanceof EventAIError ? error : new EventAIError("unavailable");
    return NextResponse.json({ success: false, error: safe.message }, { status: safe.status, headers: { ...headers, ...(safe.code === "rate" ? { "Retry-After": "600" } : {}) } });
  }
}
