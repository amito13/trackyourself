import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APPEARANCE_KEY, createAppearanceStore } from '../src/features/appearance/store.ts';
import { palettes } from '../src/constants/palettes.ts';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function memoryStorage(initial = null) {
  let saved = initial;
  return {
    getItem: async (key) => { assert.equal(key, APPEARANCE_KEY); return saved; },
    setItem: async (key, value) => { assert.equal(key, APPEARANCE_KEY); saved = value; },
  };
}
test('defaults to dark and restores a saved light preference after restart', async () => {
  const storage = memoryStorage();
  const store = createAppearanceStore(storage);
  await store.getState().hydrate();
  assert.equal(store.getState().mode, 'dark');
  store.getState().setMode('light');
  assert.equal(store.getState().mode, 'light');
  await tick();
  const restarted = createAppearanceStore(storage);
  await restarted.getState().hydrate();
  assert.equal(restarted.getState().mode, 'light');
  assert.equal(restarted.getState().hydrated, true);
});
test('invalid stored values and storage read failures do not block startup', async () => {
  const invalid = createAppearanceStore(memoryStorage('invalid'));
  await invalid.getState().hydrate();
  assert.equal(invalid.getState().mode, 'dark');
  const failed = createAppearanceStore({ getItem: async () => { throw new Error('unavailable'); }, setItem: async () => {} });
  await failed.getState().hydrate();
  assert.equal(failed.getState().hydrated, true);
  assert.equal(failed.getState().mode, 'dark');
  assert.ok(failed.getState().error);
});
test('late hydration cannot overwrite a newer user selection', async () => {
  let resolve;
  const store = createAppearanceStore({ getItem: () => new Promise((r) => { resolve = r; }), setItem: async () => {} });
  const ready = store.getState().hydrate();
  store.getState().setMode('light');
  resolve('dark');
  await ready;
  assert.equal(store.getState().mode, 'light');
});
test('rapid changes persist in order even with a slow storage write', async () => {
  const writes = [];
  let release;
  const store = createAppearanceStore({ getItem: async () => null, setItem: async (_, mode) => {
    if (!writes.length) await new Promise((resolve) => { release = resolve; });
    writes.push(mode);
  } });
  store.getState().setMode('light');
  store.getState().setMode('dark');
  await tick();
  assert.equal(store.getState().mode, 'dark');
  release();
  await tick();
  assert.deepEqual(writes, ['light', 'dark']);
});
test('a failed preference write can be retried by tapping the selected mode', async () => {
  let fail = true;
  const store = createAppearanceStore({ getItem: async () => null, setItem: async () => {
    if (fail) throw new Error('disk');
  } });
  store.getState().setMode('light');
  await tick();
  assert.equal(store.getState().mode, 'light');
  assert.ok(store.getState().error);
  fail = false;
  store.getState().setMode('light');
  await tick();
  assert.equal(store.getState().error, null);
});
function luminance(hex) {
  const rgb = hex.slice(1).match(/../g).map((n) => parseInt(n, 16) / 255)
    .map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
test('both palettes keep readable text and primary buttons', () => {
  for (const [mode, colors] of Object.entries(palettes)) {
    for (const background of ['background', 'surface', 'raised']) {
      for (const foreground of ['text', 'muted', 'accent']) {
        assert.ok(contrast(colors[foreground], colors[background]) >= 4.5, `${mode}: ${foreground} on ${background}`);
      }
    }
    assert.ok(contrast(colors.onAccent, colors.accent) >= 4.5);
    assert.ok(contrast(colors.success, colors.successSoft) >= 4.5);
  }
});
