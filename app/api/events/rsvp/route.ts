import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeEventTemplateKey, safeEventImageUrl, safeEventVenueUrl } from "@/lib/events/themes";
import { tokenHash, validToken } from "@/lib/events/core";
import { isAdditionalGuestCount, MAX_ADDITIONAL_GUESTS, resolveAdditionalGuests, type RsvpResponse } from "@/lib/events/guest-counts";
const headers = {"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
async function resolve(token:unknown) {
  if (!validToken(token)) return null;
  return prisma.eventInvitation.findFirst({where:{tokenHash:tokenHash(token),event:{status:"SCHEDULED",startsAt:{gt:new Date()}}},include:{event:true}});
}
function result(invitation:NonNullable<Awaited<ReturnType<typeof resolve>>>) {
  const {title,description,location,startsAt,endsAt,timeZone} = invitation.event;
  const templateKey = normalizeEventTemplateKey(invitation.event.templateKey);
  const imageUrl = safeEventImageUrl(invitation.event.imageUrl, [process.env.R2_PUBLIC_URL]);
  const imageAlt = imageUrl ? invitation.event.imageAlt || title : null;
  const venueUrl = safeEventVenueUrl(invitation.event.venueUrl);
  return {success:true,event:{title,description,location,startsAt,endsAt,timeZone,templateKey,imageUrl,imageAlt,venueUrl},response:invitation.response,additionalGuests:invitation.additionalGuests ?? 0};
}
export async function GET(request:Request) {
  const invitation = await resolve(request.headers.get("authorization")?.replace(/^Bearer /i,""));
  return invitation ? NextResponse.json(result(invitation),{headers}) : NextResponse.json({success:false,error:"Invitation unavailable, cancelled, or expired."},{status:404,headers});
}
export async function POST(request:Request) {
  try {
    const input = await request.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({success:false,error:"Choose Yes, No, or Maybe."},{status:400,headers});
    if (!["YES","NO","MAYBE"].includes(input.response)) return NextResponse.json({success:false,error:"Choose Yes, No, or Maybe."},{status:400,headers});
    if (input.additionalGuests !== undefined && !isAdditionalGuestCount(input.additionalGuests)) return NextResponse.json({success:false,error:`Enter a whole number of additional guests from 0 to ${MAX_ADDITIONAL_GUESTS}.`},{status:400,headers});
    const invitation = await resolve(input.token);
    if (!invitation) return NextResponse.json({success:false,error:"Invitation unavailable, cancelled, or expired."},{status:404,headers});
    // Lock event row so a concurrent cancellation cannot race a response write.
    const saved = await prisma.$transaction(async tx => {
      const active = await tx.eventInvitationEvent.updateMany({where:{id:invitation.eventId,status:"SCHEDULED",startsAt:{gt:new Date()}},data:{updatedAt:new Date()}});
      if (!active.count) return null;
      // Re-read after the event lock: a concurrent RSVP may have changed the
      // count since token resolution, especially for an older cached page.
      const current = await tx.eventInvitation.findUnique({where:{id:invitation.id},select:{additionalGuests:true}});
      if (!current) return null;
      const additionalGuests = resolveAdditionalGuests(input.response as RsvpResponse,input.additionalGuests,current.additionalGuests);
      return tx.eventInvitation.update({where:{id:invitation.id},data:{response:input.response,additionalGuests,respondedAt:new Date()},select:{response:true,additionalGuests:true}});
    });
    if (!saved) return NextResponse.json({success:false,error:"This event is closed."},{status:410,headers});
    return NextResponse.json({...result(invitation),...saved},{headers});
  } catch { return NextResponse.json({success:false,error:"Could not save your response. Please try again."},{status:400,headers}); }
}
