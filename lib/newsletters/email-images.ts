const escape = (value: string) => value.replace(/[&<>'"]/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
})[character] ?? character);

function safeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? escape(parsed.toString()) : null;
  } catch {
    return null;
  }
}

export function renderNewsletterImage(input: {
  imageUrl?: string | null;
  imageAlt?: string | null;
  imageLink?: string | null;
}) {
  const image = safeUrl(input.imageUrl);
  if (!image) return "";
  const destination = safeUrl(input.imageLink);
  const markup = `<img src="${image}" alt="${escape(input.imageAlt || "")}" width="640" style="display:block;width:100%;max-width:640px;height:auto;border:0;border-radius:8px">`;
  return `<tr><td style="padding:0 42px">${destination
    ? `<a href="${destination}" style="display:block;text-decoration:none">${markup}</a>`
    : markup}</td></tr>`;
}
