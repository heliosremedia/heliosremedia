import assert from "node:assert/strict";
import test from "node:test";
import { loadWorkspaceSettings } from "./workspace-settings-core.ts";

test("tenant settings select only the resolved workspace and never fall back to Helios", async () => {
  const defaults = { businessName: "Helios" };
  const rows = new Map([["a", {businessName:"Company A"}], ["b", {businessName:"Company B"}]]);
  const reads: unknown[] = [];
  const read = async (where: {id:string}|{workspaceId:string}) => {
    reads.push(where);
    return "workspaceId" in where ? rows.get(where.workspaceId) ?? null : defaults;
  };
  assert.equal((await loadWorkspaceSettings(true, async () => "a", read, defaults)).businessName, "Company A");
  assert.equal((await loadWorkspaceSettings(true, async () => "b", read, defaults)).businessName, "Company B");
  await assert.rejects(loadWorkspaceSettings(true, async () => "missing", read, defaults), /not configured/);
  assert.deepEqual(reads, [{workspaceId:"a"},{workspaceId:"b"},{workspaceId:"missing"}]);
  await assert.rejects(loadWorkspaceSettings(true, async () => {throw new Error("Unknown host");}, read, defaults), /Unknown host/);
  assert.equal(reads.length, 3, "unknown hosts perform no settings query");
  await assert.rejects(loadWorkspaceSettings(true, async () => " ", read, defaults), /require a workspace/);
  await assert.rejects(loadWorkspaceSettings(true, async () => "a", async () => {throw new Error("Database unavailable");}, defaults), /Database unavailable/);
});
test("legacy settings retain the default record and fallback without resolving a host", async () => {
  const defaults = {businessName:"Helios"};
  const resolve = async ():Promise<string> => {throw new Error("must not resolve host");};
  assert.deepEqual(await loadWorkspaceSettings(false, resolve, async where => {
    assert.deepEqual(where,{id:"default"}); return null;
  }, defaults), defaults);
});
