import { isAdditionalGuestCount, resolveAdditionalGuests, type RsvpResponse } from "./guest-counts";
export class EventShareError extends Error { constructor(message:string,public status=400) { super(message); } }
export const shareHeaders = {"Cache-Control":"no-store, private","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
export function shareRegistrationInput(input:Record<string,unknown>) {
  const name = typeof input.name === "string" ? input.name.trim().replace(/ +/g," ") : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!name || name.length > 120 || /[\p{Cc}\p{Zl}\p{Zp}]/u.test(name)) throw new EventShareError("Enter your name (up to 120 characters).");
  if (email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || /[\p{Cc}]/u.test(email)) throw new EventShareError("Enter a valid email address.");
  if (!["YES","NO","MAYBE"].includes(input.response as string)) throw new EventShareError("Choose Yes, No, or Maybe.");
  if (!isAdditionalGuestCount(input.additionalGuests)) throw new EventShareError("Enter a whole number of additional guests from 0 to 99.");
  const response = input.response as RsvpResponse;
  return {name,email,response,additionalGuests:resolveAdditionalGuests(response,input.additionalGuests)};
}
