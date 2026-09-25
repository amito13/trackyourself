import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSyncController } from '../src/db/sync/controller.ts';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await wait(5);
  }
  assert.fail('Timed out waiting for automatic sync');
}
function setup(upload) {
  let pending = 1;
  let listener;
  let calls = 0;
  const states = [];
  const controller = createSyncController({
    pending: { list: async () => Array.from({ length: pending }, (_, i) => ({ sequence: i })) },
    subscribe: (callback) => { listener = callback; return () => { listener = undefined; }; },
  }, async (isCurrent) => {
    calls++;
    if (upload) await upload({ isCurrent, calls, clear: () => { pending = 0; } });
    else pending = 0;
  }, (state) => states.push(state), { retryDelayMs: 10, maxRetryDelayMs: 20 });
  return { controller, states, get calls() { return calls; }, get pending() { return pending; },
    commit() { pending++; listener?.(); } };
}

test('offline edits stay queued and reconnect uploads them without a manual sync', async () => {
  const h = setup();
  try {
    h.commit();
    await until(() => h.states.at(-1)?.status === 'offline');
    assert.equal(h.calls, 0);
    assert.equal(h.pending, 2);
    h.controller.setOnline(true);
    await until(() => h.states.at(-1)?.status === 'synced');
    assert.equal(h.pending, 0);
    h.commit();
    await until(() => h.calls === 2 && h.pending === 0);
  } finally { h.controller.stop(); }
});
test('failed cloud requests automatically retry and preserve pending saves', async () => {
  const h = setup(async ({ calls, clear }) => {
    if (calls === 1) throw new Error('Network request failed');
    clear();
  });
  try {
    h.controller.setOnline(true);
    await until(() => h.states.some((s) => s.status === 'error'));
    assert.equal(h.pending, 1);
    await until(() => h.states.at(-1)?.status === 'synced');
    assert.equal(h.calls, 2);
    assert.equal(h.pending, 0);
  } finally { h.controller.stop(); }
});
test('background saves wait and automatically upload when the app becomes active', async () => {
  const h = setup();
  try {
    h.controller.setActive(false);
    h.controller.setOnline(true);
    await wait(30);
    assert.equal(h.calls, 0);
    h.controller.setActive(true);
    await until(() => h.pending === 0);
    assert.equal(h.calls, 1);
  } finally { h.controller.stop(); }
});
test('going offline cancels retries; reconnect retries immediately', async () => {
  const h = setup(async ({ calls, clear }) => {
    if (calls === 1) throw new Error('Server unavailable');
    clear();
  });
  try {
    h.controller.setOnline(true);
    await until(() => h.states.at(-1)?.status === 'error');
    h.controller.setOnline(false);
    await wait(40);
    assert.equal(h.calls, 1);
    h.controller.setOnline(true);
    await until(() => h.pending === 0);
  } finally { h.controller.stop(); }
});
test('stopping cancels retries and ignores commits and connectivity events', async () => {
  const h = setup(async () => { throw new Error('Server unavailable'); });
  h.controller.setOnline(true);
  await until(() => h.states.at(-1)?.status === 'error');
  h.controller.stop();
  const count = h.states.length;
  h.commit();
  h.controller.setOnline(true);
  await wait(40);
  assert.equal(h.calls, 1);
  assert.equal(h.states.length, count);
});
test('new edits during an upload are drained with no overlapping requests', async () => {
  let release;
  let concurrent = 0;
  let maxConcurrent = 0;
  const h = setup(async ({ calls, clear }) => {
    concurrent++;
    maxConcurrent = Math.max(maxConcurrent, concurrent);
    if (calls === 1) await new Promise((resolve) => { release = resolve; });
    else clear();
    concurrent--;
  });
  try {
    h.controller.setOnline(true);
    await until(() => !!release);
    h.commit();
    release();
    await until(() => h.states.at(-1)?.status === 'synced');
    assert.equal(h.calls, 2);
    assert.equal(maxConcurrent, 1);
  } finally { h.controller.stop(); }
});
test('a disconnect during upload cannot publish a false synced status', async () => {
  let release;
  const h = setup(async ({ isCurrent }) => {
    await new Promise((resolve) => { release = resolve; });
    assert.equal(isCurrent(), false);
  });
  try {
    h.controller.setOnline(true);
    await until(() => !!release);
    h.controller.setOnline(false);
    release();
    await until(() => h.states.at(-1)?.status === 'offline');
    assert.equal(h.pending, 1);
    assert.equal(h.states.some((s) => s.status === 'synced'), false);
  } finally { h.controller.stop(); }
});
