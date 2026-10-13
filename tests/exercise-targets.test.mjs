import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { exerciseTargetArt } from '../src/constants/exercise-targets.ts';

test('every seeded exercise has valid base64 SVG artwork for the native image loader', () => {
  const seed = readFileSync(new URL('../src/db/migrations/001_initial_schema.sql', import.meta.url), 'utf8');
  const names = [...seed.matchAll(/\('([^']+)', '[^']+', '(?:reps|duration)', '(?:weighted|bodyweight)'\)/g)].map((match) => match[1]);
  assert.ok(names.length > 30);
  for (const name of names) {
    const art = exerciseTargetArt(name);
    assert.ok(art, name);
    assert.ok(art.uri.startsWith('data:image/svg+xml;base64,'), name);
    const payload = art.uri.split(',')[1];
    const svg = Buffer.from(payload, 'base64').toString('utf8');
    assert.ok(svg.startsWith('<svg ') && svg.endsWith('</svg>'), name);
    assert.equal(Buffer.from(svg).toString('base64'), payload, name);
    assert.ok(svg.includes('#b8f35b'), name);
  }
});

test('core targeting distinguishes twists from leg raises and normalizes names', () => {
  assert.equal(exerciseTargetArt('Russian Twist').label, 'Obliques');
  assert.equal(exerciseTargetArt('Hanging Leg Raise').label, 'Abs');
  assert.equal(exerciseTargetArt(' hanging-leg_raise '), exerciseTargetArt('Hanging Leg Raise'));
  assert.equal(exerciseTargetArt('Unknown exercise'), undefined);
});
