import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as rules from "../client-communications/workspace-token-rules.ts";
import { hashPreferenceToken, MARKETING_TOKEN_TTL_DAYS } from "../client-communications/preference-rules.ts";

const claim = { workspaceId: "a", storedWorkspaceId: "a", campaignId: "campaign", revisionId: "revision", campaignVersion: 1, attemptId: "attempt", leaseExpiresAt: new Date(Date.now() + 60000) };
const input = { clientId: "client", invitationId: "invitation", email: " Person@Example.test ", tokenSeed: "A".repeat(43) };
function fixture() {
  const state = { tenant: true, eligible: true, sourceValid: true, invitation: true, client: true, preference: { id: "preference" } as { id: string } | null, issued: false, legacyMarker: false, conflict: false, previous: null as Record<string, unknown> | null, rows: [{ id: "a" }], writes: [] as Array<{ kind: string; data: Record<string, unknown> }>, sourceReads: 0 };
  const tx = {
    $queryRaw: async () => {}, $executeRaw: async () => {}, workspace: { findMany: async () => state.rows },
    referralInvitation: { findFirst: async ({ where }: { where: Record<string, unknown> }) => { assert.equal(where.campaignId, claim.campaignId); assert.equal(where.approvedRevisionId, claim.revisionId); assert.equal(JSON.stringify(where.advocate), JSON.stringify({ clientId: input.clientId, campaignId: claim.campaignId })); return state.invitation ? { id: "invitation" } : null; } },
    communicationClient: { findFirst: async ({ where }: { where: Record<string, unknown> }) => { assert.equal(where.normalizedEmail, "person@example.test"); assert.equal(where.emailSubscribed, true); assert.equal(where.emailStatus, "VALID"); assert.equal(JSON.stringify(where.workspaceMemberships), JSON.stringify({ some: { workspaceId: "a" } })); return state.client ? { id: "client" } : null; } },
    workspaceMarketingPreference: { findUnique: async () => state.preference },
    workspaceMarketingPreferenceToken: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => (where.OR ? state.conflict : state.issued) ? { id: "issued" } : null,
      findUnique: async () => state.previous,
      create: async ({ data }: { data: Record<string, unknown> }) => { state.writes.push({ kind: "company", data }); state.previous = data; return data; },
    },
    marketingEmailPreference: { upsert: async () => ({ id: "legacy" }) },
    marketingEmailPreferenceToken: { findFirst: async () => state.legacyMarker ? { id: "legacy-token" } : null, create: async ({ data }: { data: Record<string, unknown> }) => { state.writes.push({ kind: "legacy", data }); return data; } },
  };
  const exports = {} as { createReferralPreparationPreferenceToken: (db: unknown, source: typeof claim, fields: typeof input) => Promise<string> };
  const modules: Record<string, unknown> = {
    "server-only": {}, "@/lib/workspace-context-core": { tenantContextEnabled: () => state.tenant },
    "@/lib/client-communications/normalization": { normalizeEmail: (email: string) => email.trim().toLowerCase() },
    "@/lib/client-communications/delivery-consent": { workspaceAddressIsMarketingEligible: async (db: unknown, workspaceId: string, email: string) => { assert.equal(db, tx); assert.equal(workspaceId, "a"); assert.equal(email, "person@example.test"); return state.eligible; } },
    "@/lib/client-communications/preference-rules": { hashPreferenceToken, MARKETING_TOKEN_TTL_DAYS },
    "@/lib/client-communications/workspace-token-rules": rules,
    "./preparation-claim": { lockReferralPreparationSource: async (db: unknown, source: unknown) => { assert.equal(db, tx); assert.equal(source, claim); state.sourceReads++; if (!state.sourceValid) throw new Error("CLAIM_EXPIRED"); } },
  };
  runInNewContext(ts.transpileModule(readFileSync(new URL("./preparation-consent.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Error, require: (id: string) => { assert.ok(id in modules, id); return modules[id]; } });
  return { state, run: (fields = input) => exports.createReferralPreparationPreferenceToken(tx, claim, fields) };
}

test("referral company token binds stored invitation/revision and stores only hash with stable replay", async () => {
  const f = fixture(), token = await f.run(); assert.equal(token, `v2.${input.tokenSeed}`); assert.equal(await f.run(), token); assert.equal(f.state.writes.length, 1);
  const saved = f.state.writes[0]; assert.equal(saved.kind, "company"); assert.equal(saved.data.workspaceId, "a"); assert.equal(saved.data.campaignId, "campaign"); assert.equal(saved.data.messageId, "invitation"); assert.equal(saved.data.source, "REFERRAL_INVITATION_REVISION_revision"); assert.equal(saved.data.tokenHash, rules.workspacePreferenceTokenHash(token)); assert.ok(!JSON.stringify(saved).includes(token));
});

test("referral token denies changed source, invitation, recipient and current eligibility before writes", async () => {
  for (const field of ["sourceValid", "invitation", "client", "eligible"] as const) { const f = fixture(); f.state[field] = false; await assert.rejects(f.run(), /CLAIM_EXPIRED|SOURCE_INVALID/); assert.equal(f.state.writes.length, 0); }
});

test("referral token rejects legacy and incompatible company protocol markers", async () => {
  for (const field of ["legacyMarker", "conflict"] as const) { const f = fixture(); f.state[field] = true; await assert.rejects(f.run(), /RETRY_REVIEW_REQUIRED/); assert.equal(f.state.writes.length, 0); }
  const f = fixture(); await f.run(); f.state.previous = { ...f.state.previous, workspaceId: "b" }; await assert.rejects(f.run(), /SOURCE_INVALID/); assert.equal(f.state.writes.length, 1);
});

test("legacy referral preparation retains its protocol only in matching sole-company compatibility", async () => {
  const f = fixture(); f.state.tenant = false; f.state.preference = null;
  assert.equal(await f.run(), input.tokenSeed); assert.equal(f.state.writes[0].kind, "legacy"); assert.equal(f.state.writes[0].data.tokenHash, hashPreferenceToken(input.tokenSeed));
  for (const rows of [[{ id: "b" }], [{ id: "a" }, { id: "b" }]]) { const other = fixture(); other.state.tenant = false; other.state.preference = null; other.state.rows = rows; await assert.rejects(other.run(), /SOURCE_INVALID/); assert.equal(other.state.writes.length, 0); }
});

test("existing company issuance and tenant mode cannot fall back to global preference creation", async () => {
  for (const tenant of [true, false]) { const f = fixture(); f.state.preference = null; f.state.tenant = tenant; f.state.issued = true; await assert.rejects(f.run(), /SOURCE_INVALID/); assert.equal(f.state.writes.length, 0); }
});

test("malformed referral token seed is rejected before database source work", async () => {
  const f = fixture(); await assert.rejects(f.run({ ...input, tokenSeed: "bad" }), /SOURCE_INVALID/); assert.equal(f.state.sourceReads, 0); assert.equal(f.state.writes.length, 0);
});
