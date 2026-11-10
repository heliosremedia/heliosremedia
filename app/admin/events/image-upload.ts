import { eventImageUploadError } from "./ui-helpers.ts";

/** A draft receives only the verified immutable URL, never the writable staging URL. */
export async function uploadEventImage(file: File, signal: AbortSignal, request: typeof fetch = fetch) {
  const validationError = eventImageUploadError(file);
  if (validationError) throw new Error(validationError);
  signal.throwIfAborted();
  const response = await request("/api/admin/events/images/presign", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }) });
  const data = await response.json();
  signal.throwIfAborted();
  if (!response.ok || !data.success) throw new Error(data.error || "The image could not be prepared.");
  const uploaded = await request(data.upload.uploadUrl, { method: "PUT", signal, headers: { "Content-Type": data.upload.contentType }, body: file, referrerPolicy: "no-referrer" });
  signal.throwIfAborted();
  if (!uploaded.ok) throw new Error("The image upload did not complete. Please try again.");
  const completed = await request("/api/admin/events/images/complete", { method: "POST", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: data.upload.key }) });
  const finalImage = await completed.json();
  signal.throwIfAborted();
  if (!completed.ok || !finalImage.success || !finalImage.imageUrl) throw new Error(finalImage.error || "The image could not be verified. Please try another JPG or PNG.");
  return { url: finalImage.imageUrl as string, altText: (finalImage.imageAlt || file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ")).slice(0, 300) as string };
}
