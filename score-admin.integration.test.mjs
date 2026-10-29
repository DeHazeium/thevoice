// Exercise the actual app adapter with an in-memory transaction endpoint.
// No Firebase requests or production writes are made by this test.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
globalThis.localStorage = { getItem: () => '' };
const source = (await readFile(new URL('./app.js', import.meta.url), 'utf8'))
  .replace(/from (["'])(\.\/[^"']+)\1/g, (_, quote, path) => `from ${quote}${new URL(path, import.meta.url).href}${quote}`)
  .replace(/\binit\(\);\s*$/, 'export { FirebaseAdapter, state };');
const { FirebaseAdapter, state } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const adapter = new FirebaseAdapter();
adapter.basePath = 'events/test-only'; adapter.base = adapter.basePath;
const original = {artistId:'a',judgeId:'judge1',values:[1,2,3,4],total:10,submitted:true,updatedAt:1};
let stored = structuredClone(original);
let writes = 0;
let lastPath;
adapter.rtdb = {
  ref: (_, path) => path,
  serverTimestamp: () => 456,
  runTransaction: async (path, update, options) => {
    assert.equal(options.applyLocally,false);
    lastPath = path;
    const next = update(structuredClone(stored));
    if (next === undefined) return {committed:false};
    stored = next; writes++; return {committed:true};
  }
};
state.ready = false;
await assert.rejects(adapter.correctScore(original,original),/Live connection/);
assert.equal(writes,0);
state.ready = true;
const corrected = {...original,values:[8.75,9.25,8.55,9.35],total:35.9};
await adapter.correctScore(corrected,original);
assert.equal(lastPath,'events/test-only/scores/a_judge1');
assert.equal(stored.total,35.9);
assert.equal(stored.updatedAt,456);
await assert.rejects(adapter.correctScore(corrected,original),/changed on another device/);
assert.equal(writes,1);
stored = {contestants:{a:{id:'a',previousScore:27.5}},scores:{a_judge1:stored},config:{maxScore:10}};
await adapter.resetAllScores();
assert.equal(lastPath,'events/test-only');
assert.equal(writes,2);
assert.equal(stored.contestants.a.previousScore,0);
assert.equal(stored.lastResetBackup.scores.a_judge1.total,35.9);
assert.ok(Object.values(stored.scores).every(score=>score.total===0 && !score.submitted));
console.log('App adapter: offline guard, targeted correction, conflicting save rejection and one-transaction reset passed.');
