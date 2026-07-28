import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Portfolio and Services share the compact centered filter control",()=>{
  const shared=readFileSync(new URL("../app/components/CompactFilter.tsx",import.meta.url),"utf8");
  const portfolio=readFileSync(new URL("../app/portfolio/page.tsx",import.meta.url),"utf8");
  const services=readFileSync(new URL("../app/services/page.tsx",import.meta.url),"utf8");
  assert.match(shared,/inline-flex min-h-11/);
  assert.match(shared,/items-center justify-center/);
  assert.doesNotMatch(shared,/translate|absolute|top-/);
  assert.match(portfolio,/CompactFilterLink/);
  assert.match(services,/CompactFilterAnchor/);
});
