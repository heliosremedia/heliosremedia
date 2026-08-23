import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/admin/social-studio/settings/SocialSettings.tsx", "utf8");

test("Social Studio Voice is collapsed by default and exposes accessible controls", () => {
  assert.match(source, /const \[voiceOpen, setVoiceOpen\] = useState\(false\)/);
  assert.match(source, /aria-expanded=\{voiceOpen\}/);
  assert.match(source, /aria-controls="social-voice-editor"/);
  assert.match(source, /voiceOpen \? "Collapse voice editor" : "Edit social voice"/);
  assert.match(source, /\{voiceOpen && <div id="social-voice-fields">/);
});
