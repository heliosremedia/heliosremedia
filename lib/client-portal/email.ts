import "server-only";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function sendPortalVerificationEmail(input: {
  email: string;
  businessName: string;
  portalName: string;
  verificationUrl: string;
  purpose: "LOGIN" | "REGISTER";
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.PORTAL_EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    throw new Error("Client portal email delivery has not been configured.");
  }

  const action = input.purpose === "REGISTER" ? "finish creating your account" : "open your client dashboard";
  const portalName = escapeHtml(input.portalName);
  const verificationUrl = escapeHtml(input.verificationUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: `${input.businessName.replace(/[\r\n]+/g, " ").trim()} client portal`,
      html: `<div style="background:#0b0b0b;color:#f4f0e9;padding:40px;font-family:Arial,sans-serif"><div style="max-width:560px;margin:auto"><p style="color:#df6b2b;text-transform:uppercase;letter-spacing:.18em;font-size:12px">${portalName}</p><h1 style="font-weight:400">Your secure client portal link</h1><p style="color:#b7b2ac;line-height:1.7">Use the button below to ${action}. This link expires in 15 minutes and can only be used once.</p><p style="margin:32px 0"><a href="${verificationUrl}" style="display:inline-block;background:#df6b2b;color:#fff;text-decoration:none;padding:16px 24px;text-transform:uppercase;letter-spacing:.15em;font-size:12px">Continue securely</a></p><p style="color:#777;font-size:12px;line-height:1.6">If you did not request this link, you can safely ignore this message.</p></div></div>`,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    console.error("Resend rejected a client portal email", {
      status: response.status,
      details: details.slice(0, 1_000),
    });
    throw new Error("The verification email could not be sent.");
  }
}
