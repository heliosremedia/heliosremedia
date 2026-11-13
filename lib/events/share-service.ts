import "server-only";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt, newToken, tokenHash, validToken } from "./core";
import { EventShareError, shareRegistrationInput } from "./share-core";
import { getSiteUrl } from "@/lib/site";
import { normalizeEventTemplateKey, safeEventImageUrl, safeEventVenueUrl } from "./themes";

const unavailable = () => new EventShareError("Invitation unavailable, cancelled, or expired.",404);
export async function getOrCreateEventShareLink(eventId:string,workspaceId:string) {
  return prisma.$transaction(async tx => {
    const active = await tx.eventInvitationEvent.updateMany({where:{id:eventId,workspaceId,status:"SCHEDULED",startsAt:{gt:new Date()}},data:{updatedAt:new Date()}});
    if (!active.count) throw unavailable();
    let link = await tx.eventShareLink.findUnique({where:{eventId}});
    if (!link) {
      const token = newToken();
      link = await tx.eventShareLink.create({data:{eventId,tokenHash:tokenHash(token),encryptedToken:encrypt(token,process.env.AUTH_SECRET || "")}});
    }
    const token = decrypt(link.encryptedToken,process.env.AUTH_SECRET || "");
    if (!validToken(token) || tokenHash(token) !== link.tokenHash) throw new Error("Invalid share credential.");
    return `${getSiteUrl()}/events/invite#token=${encodeURIComponent(token)}`;
  });
}
async function resolveShareLink(token:unknown) {
  if (!validToken(token)) throw unavailable();
  const link = await prisma.eventShareLink.findUnique({where:{tokenHash:tokenHash(token)},include:{event:true}});
  if (!link || link.event.status !== "SCHEDULED" || link.event.startsAt <= new Date()) throw unavailable();
  return link;
}
export async function getSharedEvent(token:unknown) {
  const {event} = await resolveShareLink(token);
  const imageUrl = safeEventImageUrl(event.imageUrl,[process.env.R2_PUBLIC_URL]);
  // Explicit public allowlist: never expose audience, credentials, workspace or response data.
  return {title:event.title,description:event.description,location:event.location,startsAt:event.startsAt,endsAt:event.endsAt,timeZone:event.timeZone,templateKey:normalizeEventTemplateKey(event.templateKey),imageUrl,imageAlt:imageUrl ? event.imageAlt || event.title : null,venueUrl:safeEventVenueUrl(event.venueUrl)};
}
export async function registerSharedGuest(input:Record<string,unknown>) {
  const details = shareRegistrationInput(input);
  if (!validToken(input.registrationToken) || input.registrationToken === input.token) throw new EventShareError("Reload the invitation to start a secure response.");
  const personalToken = input.registrationToken;
  const personalHash = tokenHash(personalToken);
  const link = await resolveShareLink(input.token);
  const saved = await prisma.$transaction(async tx => {
    const active = await tx.eventInvitationEvent.updateMany({where:{id:link.eventId,status:"SCHEDULED",startsAt:{gt:new Date()}},data:{updatedAt:new Date()}});
    if (!active.count) throw unavailable();
    const duplicate = new EventShareError("An invitation or response already exists for this email. Use your original personal invitation or contact the host; no existing response was changed.",409);
    const existing = await tx.eventInvitation.findFirst({where:{eventId:link.eventId,OR:[{email:details.email},{tokenHash:personalHash}]}});
    if (existing) {
      // Only this exact registration's unguessable credential can replay its result.
      if (existing.source !== "SHARED_LINK" || existing.tokenHash !== personalHash || existing.email !== details.email) throw duplicate;
      return {response:existing.response,additionalGuests:existing.additionalGuests};
    }
    if (await tx.eventInvitation.count({where:{eventId:link.eventId,source:"SHARED_LINK"}}) >= 1000 || await tx.eventInvitation.count({where:{eventId:link.eventId,source:"SHARED_LINK",createdAt:{gt:new Date(Date.now()-60_000)}}}) >= 30) throw new EventShareError("New responses are temporarily limited. Please try later or contact the host.",429);
    const invitation = await tx.eventInvitation.create({data:{eventId:link.eventId,clientId:`shared:${personalHash}`,source:"SHARED_LINK",email:details.email,displayName:details.name,tokenHash:personalHash,encryptedToken:encrypt(personalToken,process.env.AUTH_SECRET || ""),response:details.response,additionalGuests:details.additionalGuests,respondedAt:new Date()},select:{response:true,additionalGuests:true}});
    // No CRM enrollment, marketing subscription, delivery creation, or provider calls.
    return invitation;
  });
  return {...saved,rsvpUrl:`${getSiteUrl()}/events/rsvp#token=${encodeURIComponent(personalToken)}`};
}
