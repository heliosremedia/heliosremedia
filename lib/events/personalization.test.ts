import test from "node:test";
import assert from "node:assert/strict";
import { eventRecipientFirstName, personalizeEventCopy, personalizeEventText } from "./personalization.ts";

test("first names use a friendly fallback and preserve Unicode names", () => {
  for (const name of [undefined, null, "", " \t\r\n ", "\u0000\u0085\u2028"]) assert.equal(eventRecipientFirstName(name), "there");
  for (const name of ["Zoë", "李明", "أحمد", "O’Connor", "Jean-Luc", "अनुष्का"]) assert.equal(eventRecipientFirstName(`  ${name}  `), name);
  assert.equal(eventRecipientFirstName("Anna\r\nBcc:\tOther\u0000\u007f\u2028Name\u202e"), "Anna Bcc: Other Name");
  assert.equal(Array.from(eventRecipientFirstName("李".repeat(100))).length, 80);
});

test("only the exact first-name token merges, repeatedly, without recursive interpretation", () => {
  assert.deepEqual(personalizeEventCopy({ subject: "{{FIRST_NAME}}, join us, {{FIRST_NAME}}!", body: "Hi {{FIRST_NAME}},\n\nSee you, {{FIRST_NAME}}. {{EMAIL}} {{first_name}}" }, "Ana"), {
    subject: "Ana, join us, Ana!", body: "Hi Ana,\n\nSee you, Ana. {{EMAIL}} {{first_name}}",
  });
  assert.equal(personalizeEventText("Hi {{FIRST_NAME}}", "{{EMAIL}}"), "Hi {{EMAIL}}");
  assert.equal(personalizeEventCopy({subject:"Hi {{FIRST_NAME}}",body:"Hi {{FIRST_NAME}}"}).body, "Hi there");
});

test("personalized subjects stay single-line and bounded after expansion", () => {
  const result = personalizeEventCopy({ subject: "{{FIRST_NAME}}".repeat(20) + "\r\nBcc: other@example.com\u0000", body: "Hi {{FIRST_NAME}}" }, "李".repeat(100) + "\r\n");
  assert.equal(Array.from(result.subject).length, 200);
  assert(!/[\p{Cc}\p{Zl}\p{Zp}]/u.test(result.subject));
  assert.equal(result.body, `Hi ${"李".repeat(80)}`);
});

test("tokens inside copied URL destinations are not substituted", () => {
  const text = "Hi {{FIRST_NAME}}. [Venue](https://venue.example/{{FIRST_NAME}}) https://studio.example/rsvp#token={{FIRST_NAME}} mailto:{{FIRST_NAME}}@example.com";
  assert.equal(personalizeEventText(text,"Alex"), text.replace("Hi {{FIRST_NAME}}", "Hi Alex"));
});
