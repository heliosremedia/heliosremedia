import { NextResponse } from "next/server";
import { eventAdmin, getEvent, auditEvent } from "@/lib/events/service";
import { eventError } from "@/lib/events/api";
import { EventUpdateConflict, readEventUpdateBody, eventUpdateInput } from "@/lib/events/updates-core";
import { renderEventUpdate } from "@/lib/events/updates-email";
import { eventUpdateAudienceCount, scheduleEventUpdate, cancelEventUpdate } from "@/lib/events/updates-service";
import { sendTestCampaign } from "@/lib/client-communications/email";

export async function POST(request: Request, ctx: {params: Promise<{eventId: string}>}) {
  try {
    const session = await eventAdmin();
    const {eventId} = await ctx.params;
    const event = await getEvent(eventId,session.workspaceId);
    const input = await readEventUpdateBody(request);
    const json = (data: object) => NextResponse.json({success:true,...data},{headers:{"Cache-Control":"no-store"}});
    if (!["preview","test","schedule","cancel"].includes(input.action as string)) throw new Error("Choose preview, test, schedule, or cancel.");
    if (input.action !== "preview" && input.confirm !== true) throw new Error("Confirm the exact test recipient, update audience and schedule, or cancellation before proceeding.");
    if (input.action === "cancel") {
      const updated = await cancelEventUpdate(eventId,session.workspaceId,input.deliveryId);
      await auditEvent(session,eventId,"UPDATE_CANCELLED");
      return json({event:updated,message:"Pending update cancelled. Already accepted emails cannot be recalled."});
    }
    const copy = eventUpdateInput(input);
    if (input.action === "preview") return json({...renderEventUpdate(event,copy),audienceCount:await eventUpdateAudienceCount(eventId,session.workspaceId,copy.audience)});
    if (input.action === "test") {
      const to = typeof input.testEmail === "string" ? input.testEmail.trim().toLowerCase() : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 254) throw new Error("Enter a valid test email.");
      await sendTestCampaign({to,...renderEventUpdate(event,copy),source:"test"});
      await auditEvent(session,eventId,"UPDATE_TEST_SENT");
      return json({message:`Test sent to ${to}. RSVP is disabled.`});
    }
    const result = await scheduleEventUpdate(eventId,session.workspaceId,input);
    if (!result.replayed) await auditEvent(session,eventId,"UPDATE_SCHEDULED");
    return json({event:result.event,message:result.replayed ? "This update was already saved. No duplicate delivery was created." : "Event update scheduled. Your original three emails are unchanged. No email was sent by this request."});
  } catch (error) {
    if (error instanceof EventUpdateConflict) return NextResponse.json({success:false,error:error.message},{status:409,headers:{"Cache-Control":"no-store"}});
    return eventError(error);
  }
}
