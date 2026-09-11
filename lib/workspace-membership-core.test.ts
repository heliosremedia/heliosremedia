import assert from "node:assert/strict";
import test from "node:test";
import { resolveMembershipAccess, type Membership } from "./workspace-membership-core.ts";

const user = { id: "alice", active: true, workspaceId: "company-a", role: "OWNER" as const };
const rows: Membership[] = [
  { userId: "alice", workspaceId: "company-a", role: "EDITOR", status: "ACTIVE" },
  { userId: "alice", workspaceId: "company-b", role: "OWNER", status: "ACTIVE" },
  { userId: "bob", workspaceId: "company-b", role: "ADMIN", status: "ACTIVE" },
];
const lookup = async (userId: string, workspaceId: string) => rows.find(r => r.userId === userId && r.workspaceId === workspaceId) ?? null;

test("flag off preserves legacy role without accessing the new table", async () => {
  assert.deepEqual(await resolveMembershipAccess(user, false, async () => { throw new Error("table unavailable"); }), { workspaceId: "company-a", role: "OWNER" });
});
test("two companies retain independent roles for the same identity", async () => {
  assert.deepEqual(await resolveMembershipAccess(user, true, lookup), { workspaceId: "company-a", role: "EDITOR" });
  assert.deepEqual(await resolveMembershipAccess({ ...user, workspaceId: "company-b" }, true, lookup), { workspaceId: "company-b", role: "OWNER" });
});
test("another company's administrator has no membership in company A", async () => {
  assert.equal(await resolveMembershipAccess({ ...user, id: "bob" }, true, lookup), null);
});
test("mismatched lookup results cannot grant access", async () => {
  assert.equal(await resolveMembershipAccess(user, true, async () => rows[1]), null);
  assert.equal(await resolveMembershipAccess(user, true, async () => ({ ...rows[0], userId: "bob" })), null);
});
test("missing, invited, suspended and revoked memberships deny access", async () => {
  assert.equal(await resolveMembershipAccess(user, true, async () => null), null);
  for (const status of ["INVITED", "SUSPENDED", "REVOKED"]) {
    assert.equal(await resolveMembershipAccess(user, true, async () => ({ ...rows[0], status })), null);
  }
});
test("disabled identity is denied even with an active membership", async () => {
  assert.equal(await resolveMembershipAccess({ ...user, active: false }, true, lookup), null);
});
test("database failures never fall back to legacy owner access", async () => {
  await assert.rejects(resolveMembershipAccess(user, true, async () => { throw new Error("database unavailable"); }), /database unavailable/);
});
test("revocation takes effect on the next authorization lookup", async () => {
  let status = "ACTIVE";
  const mutableLookup = async () => ({ ...rows[0], status });
  assert.ok(await resolveMembershipAccess(user, true, mutableLookup));
  status = "REVOKED";
  assert.equal(await resolveMembershipAccess(user, true, mutableLookup), null);
});
