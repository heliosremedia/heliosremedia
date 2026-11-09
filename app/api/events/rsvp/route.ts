import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tokenHash, validToken } from "@/lib/events/core";
const headers = {"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
async function resolve(token:unknown) {
  if (!validToken(token)) return null;
  return prisma.eventInvitation.findFirst({where:{tokenHash:tokenHash(token),event:{status:"SCHEDULED",startsAt:{gt:new Date()}}},include:{event:true}});
}
function result(invitation:NonNullable<Awaited<ReturnType<typeof resolve>>>) {
  const {title,description,location,startsAt,endsAt,timeZone} = invitation.event;
  return {success:true,event:{title,description,location,startsAt,endsAt,timeZone},response:invitation.response};
}
export async function GET(request:Request) {
  const invitation = await resolve(request.headers.get("authorization")?.replace(/^Bearer /i,""));
  return invitation ? NextResponse.json(result(invitation),{headers}) : NextResponse.json({success:false,error:"Invitation unavailable, cancelled, or expired."},{status:404,headers});
}
export async function POST(request:Request) {
  try {
    const input = await request.json();
    if (!["YES","NO"].includes(input.response)) return NextResponse.json({success:false,error:"Choose Yes or No."},{status:400,headers});
    const invitation = await resolve(input.token);
    if (!invitation) return NextResponse.json({success:false,error:"Invitation unavailable, cancelled, or expired."},{status:404,headers});
    // Lock event row so a concurrent cancellation cannot race a response write.
    const saved = await prisma.$transaction(async tx => {
      const active = await tx.eventInvitationEvent.updateMany({where:{id:invitation.eventId,status:"SCHEDULED",startsAt:{gt:new Date()}},data:{updatedAt:new Date()}});
      if (!active.count) return false;
      await tx.eventInvitation.update({where:{id:invitation.id},data:{response:input.response,respondedAt:new Date()}}); return true;
    });
    if (!saved) return NextResponse.json({success:false,error:"This event is closed."},{status:410,headers});
    return NextResponse.json({...result(invitation),response:input.response},{headers});
  } catch { return NextResponse.json({success:false,error:"Could not save your response. Please try again."},{status:400,headers}); }
}
