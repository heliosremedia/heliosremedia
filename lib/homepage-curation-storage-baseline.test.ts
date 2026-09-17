import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
/* eslint-disable @typescript-eslint/no-explicit-any -- Isolated actual-route storage fault. */
test('curation removal retains old object for uncertain acknowledgement recovery', async () => {
 let deletions = 0;
 const tx = { homepageWorkCard: { findFirst: async () => ({ id: 'c1', imageStorageKey: 'old.webp', videoStorageKey: null }), deleteMany: async () => ({ count: 1 }) } };
 const modules: Record<string, any> = { 'next/server': { NextResponse: Response }, '@/lib/auth/session': { getAdminSession: async () => ({ role: 'EDITOR', workspaceId: 'a' }) }, '@/lib/content-image-storage': { verifyContentImage() {}, deleteContentImage: async () => { deletions++; } }, '@/lib/homepage-curation-write': { withCurationWrite: async (_actor: any, _scope: any, _request: any, fn: any) => fn(tx, new Date()) } };
 const exports: any = {};
 runInNewContext(ts.transpileModule(readFileSync('app/api/admin/homepage-work-cards/route.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, URL, Error, console, require: (id: string) => { assert.ok(id in modules); return modules[id]; } });
 assert.equal((await exports.DELETE(new Request('http://localhost/api?cardId=c1', { method: 'DELETE' }))).status, 200);
 assert.equal(deletions, 0);
});
