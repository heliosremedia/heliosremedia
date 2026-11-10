import { NextResponse } from "next/server";
import { eventAdmin, validateEventImageSelection } from "@/lib/events/service";
import { eventError } from "@/lib/events/api";
import { renderEventEmail } from "@/lib/events/email";
import { eventPreviewInput, readEventPreviewBody } from "@/lib/events/preview";

export async function POST(request: Request) {
  try {
    const session = await eventAdmin();
    const {event, stage, placeholders} = eventPreviewInput(await readEventPreviewBody(request));
    await validateEventImageSelection(event.imageUrl, session.workspaceId);
    const {html, subject} = renderEventEmail(event, stage);
    return NextResponse.json({success:true,html,subject,placeholders},{headers:{"Cache-Control":"no-store"}});
  } catch (error) { return eventError(error); }
}
