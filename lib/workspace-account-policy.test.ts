import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  getAccountIdentity,
  getProtectedOwnerMutationError,
} from "./workspace-account-policy.ts";

test("keeps display name and professional title structurally separate", () => {
  assert.deepEqual(getAccountIdentity("Jake Guerin", "Owner / Photographer"), {
    displayName: "Jake Guerin",
    professionalTitle: "Owner / Photographer",
  });
});

test("uses neutral missing-profile labels without inventing identity", () => {
  assert.deepEqual(getAccountIdentity(" ", null), {
    displayName: "Name not provided",
    professionalTitle: "Not provided",
  });
});

test("denies owner deactivation and normal role demotion", () => {
  assert.equal(
    getProtectedOwnerMutationError("OWNER", { role: null, active: false }),
    "The workspace owner cannot be deactivated.",
  );
  assert.match(
    getProtectedOwnerMutationError("OWNER", { role: "ADMIN", active: null }) ?? "",
    /ownership transfer/i,
  );
});

test("allows safe owner and non-owner account updates", () => {
  assert.equal(
    getProtectedOwnerMutationError("OWNER", { role: null, active: true }),
    null,
  );
  assert.equal(
    getProtectedOwnerMutationError("ADMIN", { role: "EDITOR", active: false }),
    null,
  );
});

test("workspace account UI preserves identity hierarchy and responsive controls", () => {
  const manager = readFileSync(
    new URL("../app/admin/users/UserManager.tsx", import.meta.url),
    "utf8",
  );
  assert.match(manager, /identity\.displayName/);
  assert.match(manager, /mailto:\$\{user\.email\}/);
  assert.match(manager, /Professional title/);
  assert.match(manager, /Permission role/);
  assert.match(manager, /xl:grid-cols/);
  assert.match(manager, /min-h-11/);
  assert.match(manager, /aria-describedby=\{isOwner \? ownerReasonId/);
  assert.doesNotMatch(manager, /className="truncate/);
});

test("account mutations remain tenant-scoped and owner protection is server enforced", () => {
  const route = readFileSync(
    new URL("../app/api/admin/users/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /findFirst\(\{ where: \{ id: userId, workspaceId: session\.workspaceId \} \}\)/);
  assert.match(route, /getProtectedOwnerMutationError\(target\.role/);
  assert.match(route, /Only an owner can reset another user's password/);
});

test("invitation and public credits keep professional identity separate from access", () => {
  const manager = readFileSync(
    new URL("../app/admin/users/UserManager.tsx", import.meta.url),
    "utf8",
  );
  const portfolio = readFileSync(
    new URL("../app/portfolio/[slug]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(manager, /displayName: name, title, email, role/);
  assert.match(manager, /Controls Studio access; it is never shown as a public project credit/);
  assert.match(portfolio, /label: contributor\.externalDiscipline \|\| contributor\.titleSnapshot/);
  assert.match(portfolio, /value: contributor\.displayNameSnapshot/);
});
