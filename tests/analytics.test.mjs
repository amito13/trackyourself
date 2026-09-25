import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from 'bun:sqlite';
import { ANALYTICS_SQL } from '../src/db/repositories/analytics.ts';
import { buildAnalytics, periodBounds, percentChange } from '../src/features/analyze/model.ts';

const row = (date, overrides = {}) => ({ session_id: date, workout_date: date, exercise_id: 'bench', exercise_name: 'Bench press', volume: 100, heaviest: 20, completed_sets: 1, ...overrides });

test('date windows include today and handle leap days with equal prior periods', () => {
  assert.deepEqual(periodBounds(7, '2024-03-03'), { start: '2024-02-26', previousStart: '2024-02-19', end: '2024-03-03' });
  assert.deepEqual(periodBounds(30, '2026-01-01'), { start: '2025-12-03', previousStart: '2025-11-03', end: '2026-01-01' });
});
test('volume comparison excludes out-of-range rows, fills rest days, and counts sessions once', () => {
  const stats = buildAnalytics([
    row('2026-09-18', { volume: 200 }),
    row('2026-09-19', { volume: 50 }),
    row('2026-09-19', { exercise_id: 'squat', volume: 150 }),
    row('2026-09-25', { volume: 100 }),
    row('2026-09-26', { volume: 999 }),
    row('2026-09-01', { volume: 999 }),
  ], 7, '2026-09-25');
  assert.equal(stats.totalVolume, 300);
  assert.equal(stats.previousVolume, 200);
  assert.equal(stats.change, 50);
  assert.equal(stats.sessions, 2);
  assert.equal(stats.sets, 3);
  assert.deepEqual(stats.volume.map((p) => p.value), [200, 0, 0, 0, 0, 0, 100]);
});
test('weight trends select one exercise and take the heaviest of multiple sessions each day', () => {
  const stats = buildAnalytics([
    row('2026-09-25', { heaviest: 40 }), row('2026-09-25', { heaviest: 60 }),
    row('2026-09-24', { heaviest: 50 }),
    row('2026-09-25', { exercise_id: 'squat', exercise_name: 'Squat', heaviest: 120 }),
    row('2026-09-25', { exercise_id: 'plank', exercise_name: 'Plank', heaviest: null }),
  ], 7, '2026-09-25', 'bench');
  assert.equal(stats.best, 60);
  assert.deepEqual(stats.weight, [{ date: '2026-09-24', value: 50 }, { date: '2026-09-25', value: 60 }]);
  assert.equal(stats.options.length, 2);
});
test('empty and zero baseline data never invent a percentage or weight record', () => {
  const stats = buildAnalytics([], 90, '2026-09-25');
  assert.equal(stats.sessions, 0);
  assert.equal(stats.change, null);
  assert.equal(stats.best, null);
  assert.equal(stats.volume.length, 13);
  assert.equal(stats.volume.at(-1).endDate, '2026-09-25');
  assert.equal(percentChange(100, 0), null);
  assert.equal(percentChange(0, 100), -100);
});
test('SQLite excludes incomplete, deleted, skipped, and other-account data; only reps contribute volume', () => {
  const db = new Database(':memory:');
  try {
    db.exec(`
      CREATE TABLE workout_sessions (id TEXT, user_id TEXT, workout_date TEXT, started_at TEXT, status TEXT);
      CREATE TABLE session_exercises (id TEXT, session_id TEXT, user_id TEXT, exercise_id TEXT, exercise_name TEXT, status TEXT, deleted_at TEXT, sort_order INTEGER);
      CREATE TABLE exercise_sets (id TEXT, session_exercise_id TEXT, user_id TEXT, completed INTEGER, deleted_at TEXT, weight_type TEXT, tracking_type TEXT, weight_kg REAL, reps INTEGER);
      INSERT INTO workout_sessions VALUES ('s', 'u', '2026-09-25', '2026-09-25', 'completed'), ('active', 'u', '2026-09-25', '2026-09-25', 'active'), ('other', 'v', '2026-09-25', '2026-09-25', 'completed');
      INSERT INTO session_exercises VALUES ('e', 's', 'u', 'bench', 'Bench', 'completed', NULL, 0), ('skip', 's', 'u', 'skip', 'Skip', 'skipped', NULL, 1), ('del', 's', 'u', 'del', 'Deleted', 'completed', 'deleted', 2);
      INSERT INTO exercise_sets VALUES
        ('good', 'e', 'u', 1, NULL, 'weighted', 'reps', 20, 10),
        ('incomplete', 'e', 'u', 0, NULL, 'weighted', 'reps', 999, 10),
        ('deleted', 'e', 'u', 1, 'deleted', 'weighted', 'reps', 999, 10),
        ('bodyweight', 'e', 'u', 1, NULL, 'bodyweight', 'reps', NULL, 10),
        ('duration', 'e', 'u', 1, NULL, 'weighted', 'duration', 30, NULL),
        ('skipped', 'skip', 'u', 1, NULL, 'weighted', 'reps', 999, 10),
        ('deletedexercise', 'del', 'u', 1, NULL, 'weighted', 'reps', 999, 10);
    `);
    const result = db.query(ANALYTICS_SQL).all('u', '2026-09-19', '2026-09-25');
    assert.equal(result.length, 1);
    assert.equal(result[0].volume, 200);
    assert.equal(result[0].heaviest, 30);
    assert.equal(result[0].completed_sets, 3);
  } finally { db.close(); }
});
