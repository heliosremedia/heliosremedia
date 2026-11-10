import { EVENT_FIRST_NAME_TOKEN } from "../../../lib/events/personalization.ts";

/** Insert without discarding surrounding copy; untouched fields keep their live defaults. */
export function insertEventFirstName(input: {
  value: string;
  suggested: string;
  field: "subject" | "body";
  selectionStart?: number | null;
  selectionEnd?: number | null;
}) {
  const limit = input.field === "subject" ? 200 : 10000;
  let text: string, caret: number;
  if (!input.value.trim()) {
    const greeting = input.field === "subject" ? `${EVENT_FIRST_NAME_TOKEN}, ` : `Hi ${EVENT_FIRST_NAME_TOKEN},\n\n`;
    text = greeting + input.suggested;
    caret = greeting.length;
  } else {
    const start = Math.max(0, Math.min(input.value.length, input.selectionStart ?? input.value.length));
    const end = Math.max(start, Math.min(input.value.length, input.selectionEnd ?? start));
    text = input.value.slice(0, start) + EVENT_FIRST_NAME_TOKEN + input.value.slice(end);
    caret = start + EVENT_FIRST_NAME_TOKEN.length;
  }
  if (text.length > limit) return { error: `Make room for the first-name field. ${input.field === "subject" ? "Subjects allow 200" : "Messages allow 10,000"} characters.` } as const;
  return { text, caret } as const;
}
