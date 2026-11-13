import { NextResponse } from "next/server";
import { eventAdmin, auditEvent } from "@/lib/events/service";
import { readEventUpdateBody } from "@/lib/events/updates-core";
import { EventResendConflict } from "@/lib/events/resend-core";
import { queueInvitationResend } from "@/lib/events/resend-service";

export async function POST(request: Request, ctx: {params: Promise<{eventId: string}>}) {
  const json = (data: object, status = 200) => NextResponse.json(data,{status,headers:{"Cache-Control":"no-store"}});
  try {
    const session = await eventAdmin();
    const {eventId} = await ctx.params;
    const input = await readEventUpdateBody(request);
    if (input.confirm !== true) return json({success:false,error:"Confirm resending the invitation to this one recipient."},400);
    const result = await queueInvitationResend(eventId,session.workspaceId,input);
    if (!result.replayed) await auditEvent(session,eventId,"INDIVIDUAL_RESEND_QUEUED");
    return json({success:true,event:result.event,message:result.replayed ? "This resend request was already saved. No duplicate was queued. Refresh to check its status." : "Invitation queued for this guest only. It will send on the next delivery run; their RSVP is unchanged."});
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (error instanceof EventResendConflict) return json({success:false,error:message},409);
    if (message === "Administrator access required.") return json({success:false,error:message},403);
    if (["Event not found.","Invited guest not found."].includes(message)) return json({success:false,error:message},404);
    const safe = ["Choose one invited guest.","Create a new resend request.","Confirm the recipient's current email address.","This guest is no longer eligible for marketing email. No resend was queued.","Event update request is too large.","Enter valid event update details."];
    return json({success:false,error:safe.includes(message) ? message : "The resend could not be confirmed. Refresh or retry the same request; do not start another resend."},400);
  }
}
