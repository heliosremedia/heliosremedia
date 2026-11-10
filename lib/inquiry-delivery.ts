import "server-only";
import { prisma } from "@/lib/prisma";
import { sendInquiryConfirmation, sendInquiryNotification, type InquiryEmailResult, type InquiryNotificationInput } from "./inquiry-notifications";

export async function deliverInquiryEmails(input: InquiryNotificationInput) {
  await Promise.all(([
    ["notification", () => sendInquiryNotification(input)],
    ["confirmation", () => sendInquiryConfirmation(input)],
  ] as const).map(async ([kind, deliver]) => {
    let result: InquiryEmailResult;
    try {
      result = await deliver();
    } catch {
      result = { status: "unknown", reason: "Email acceptance could not be confirmed." };
    }
    const label = kind === "notification" ? "Owner notification" : "Submitter confirmation";
    const summary = result.status === "accepted"
      ? `${label} accepted by the email provider. Inbox delivery is not yet confirmed.`
      : `${label} ${result.status === "not_configured" ? "was not sent" : result.status === "rejected" ? "was rejected" : "could not be confirmed"}. ${result.reason}`;
    const metadata = { kind, ...result };
    if (result.status !== "accepted") console.error("Inquiry email needs attention", { inquiryId: input.inquiryId, ...metadata });
    try {
      await prisma.inquiryActivity.create({ data: {
        inquiryId: input.inquiryId,
        action: `INQUIRY_EMAIL_${result.status.toUpperCase()}`,
        summary,
        metadata,
      } });
    } catch {
      // The inquiry is already saved. Do not turn an audit failure into a failed form submission.
      console.error("Unable to record inquiry email status", { inquiryId: input.inquiryId, ...metadata });
    }
  }));
}
