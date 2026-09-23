import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRepositories } from '../../src/db/repositories';
import { LocalDatabase } from '../../src/db/sqlite/connection';

const userId = '11111111-1111-4111-8111-111111111111';
const benchId = '22222222-2222-4222-8222-222222222222';
const plankId = '33333333-3333-4333-8333-333333333333';
const connections = [];
const directories = [];
afterEach(() => {
  for (const db of connections.splice(0)) db.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function adapter(connection) {
  return {
    async execAsync(sql) { connection.exec(sql); },
    async runAsync(sql, ...params) { return connection.query(sql).run(...params); },
    async getFirstAsync(sql, ...params) { return connection.query(sql).get(...params); },
    async getAllAsync(sql, ...params) { return connection.query(sql).all(...params); },
  };
}

async function fixture(path = ':memory:', account = userId) {
  const connection = new Database(path);
  connections.push(connection);
  const local = new LocalDatabase(adapter(connection), account);
  await local.initialize();
  let date = new Date(2026, 8, 21, 10); // Monday, in the test environment's local timezone.
  const repo = createRepositories(local, { uuid: randomUUID, now: () => new Date(date) });
  await repo.profile.cacheIdentity({ id: account, name: 'Amit', email: 'amit@example.test', avatarUrl: null });
  await repo.exercises.cache([
    { id: benchId, name: 'Bench Press', muscle_group: 'Chest', image_url: null, tracking_type: 'reps', default_weight_type: 'weighted', deleted_at: null },
    { id: plankId, name: 'Plank', muscle_group: 'Core', image_url: null, tracking_type: 'duration', default_weight_type: 'bodyweight', deleted_at: null },
  ]);
  return { repo, local, connection, setDate: next => { date = next; } };
}
const plan = [{ dayOfWeek: 1, bodyParts: ['Chest', 'Core'], exerciseIds: [benchId, plankId] }];
const values = { weightType: 'weighted', weightKg: 60, reps: 10, durationSeconds: null };

async function start(repo) {
  await repo.plans.save(plan);
  const id = await repo.workouts.startOrResume();
  return repo.history.session(id);
}

describe('local workout persistence', () => {
  test('onboarding, multiple body parts, blank defaults, partial values and timed sets', async () => {
    const { repo } = await fixture();
    const workout = await start(repo);
    expect(workout.bodyParts).toEqual(expect.arrayContaining(['Chest', 'Core']));
    expect((await repo.profile.get()).onboarding_done).toBe(1);
    expect(workout.exercises[0].sets[0].weight_kg).toBeNull();
    expect(workout.exercises[0].sets[0].completed).toBe(0);
    const benchSet = workout.exercises[0].sets[0].id;
    await repo.workouts.saveSet(benchSet, { ...values, reps: null });
    await repo.workouts.saveSet(workout.exercises[1].sets[0].id, {
      weightType: 'bodyweight', weightKg: null, reps: null, durationSeconds: 45,
    });
    await repo.workouts.finish(workout.id);
    const saved = await repo.history.session(workout.id);
    expect(saved.completedSets).toBe(1);
    expect(saved.exercises[0].sets[0].weight_kg).toBe(60);
    expect(saved.exercises[0].sets[0].reps).toBeNull();
    expect(saved.exercises[0].status).toBe('pending');
    expect(saved.exercises[1].sets[0].duration_seconds).toBe(45);
    expect(saved.exercises[1].sets[0].weight_kg).toBeNull();
    await expect(repo.workouts.saveSet(benchSet, values)).rejects.toThrow('active workout');
    await expect(repo.workouts.addSet(saved.exercises[0].id)).rejects.toThrow('active workout');
    await expect(repo.workouts.startOrResume()).rejects.toThrow('already finished');
  });

  test('reopening the file resumes an unfinished workout, even on a rest day', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'tracker-test-'));
    directories.push(directory);
    const path = join(directory, 'workout.db');
    const first = await fixture(path);
    const workout = await start(first.repo);
    await first.repo.workouts.saveSet(workout.exercises[0].sets[0].id, values);
    const pendingCount = (await first.repo.pending.list()).length;
    first.connection.close();
    connections.splice(connections.indexOf(first.connection), 1);
    const second = await fixture(path);
    second.setDate(new Date(2026, 8, 22, 10));
    expect(await second.repo.workouts.today()).toBeNull();
    expect(await second.repo.workouts.startOrResume()).toBe(workout.id);
    expect((await second.repo.history.session(workout.id)).exercises[0].sets[0].reps).toBe(10);
    expect((await second.repo.pending.list()).length).toBe(pendingCount);
    expect((await second.repo.profile.get()).onboarding_done).toBe(1);
  });

  test('previous performance ignores skipped and blank occurrences; current values remain empty', async () => {
    const { repo, setDate } = await fixture();
    const first = await start(repo);
    await repo.workouts.saveSet(first.exercises[0].sets[0].id, values);
    await repo.workouts.finish(first.id);
    setDate(new Date(2026, 8, 28, 10));
    const secondId = await repo.workouts.startOrResume();
    const second = await repo.history.session(secondId);
    await repo.workouts.saveSet(second.exercises[0].sets[0].id, { ...values, weightKg: 65 });
    await repo.workouts.skipExercise(second.exercises[0].id);
    await repo.workouts.finish(secondId);
    setDate(new Date(2026, 9, 5, 10));
    const thirdId = await repo.workouts.startOrResume();
    const third = await repo.history.session(thirdId);
    const comparison = await repo.history.compare(third.exercises[0].id);
    expect(comparison.previous.session_id).toBe(first.id);
    expect(comparison.previous.sets[0].weight_kg).toBe(60);
    expect(comparison.current.sets[0].weight_kg).toBeNull();
    expect(comparison.current.sets[0].reps).toBeNull();
    await repo.workouts.finish(thirdId); // All blank: retained, not a previous performance.
    setDate(new Date(2026, 9, 12, 10));
    const fourth = await repo.history.session(await repo.workouts.startOrResume());
    expect((await repo.history.compare(fourth.exercises[0].id)).previous.session_id).toBe(first.id);
    expect((await repo.history.compare(first.exercises[0].id)).previous).toBeNull();
  });

  test('plan edits do not rewrite active or completed snapshots and invalid edits roll back', async () => {
    const { repo } = await fixture();
    const workout = await start(repo);
    await repo.plans.save([{ dayOfWeek: 2, bodyParts: ['Core'], exerciseIds: [plankId] }]);
    expect((await repo.history.session(workout.id)).title).toBe(workout.title);
    expect((await repo.history.session(workout.id)).exercises).toHaveLength(2);
    await repo.workouts.finish(workout.id);
    await repo.exercises.cache([{ id: benchId, name: 'Renamed Bench', muscle_group: 'Chest', image_url: null,
      tracking_type: 'reps', default_weight_type: 'weighted', deleted_at: null }]);
    expect((await repo.history.session(workout.id)).exercises[0].exercise_name).toBe('Bench Press');
    const before = await repo.plans.get();
    const pending = await repo.pending.list();
    await expect(repo.plans.save([{ dayOfWeek: 1, bodyParts: ['Chest'], exerciseIds: ['missing'] }])).rejects.toThrow();
    expect(await repo.plans.get()).toEqual(before);
    expect(await repo.pending.list()).toEqual(pending);
  });

  test('concurrent starts create one session; completed exercises do not finish it', async () => {
    const { repo } = await fixture();
    await repo.plans.save(plan);
    const ids = await Promise.all([repo.workouts.startOrResume(), repo.workouts.startOrResume()]);
    expect(ids[0]).toBe(ids[1]);
    const workout = await repo.history.session(ids[0]);
    await repo.workouts.saveSet(workout.exercises[0].sets[0].id, values);
    await repo.workouts.completeExercise(workout.exercises[0].id);
    expect((await repo.workouts.active()).id).toBe(ids[0]);
    expect(await repo.history.list()).toHaveLength(0);
  });

  test('removed sets are tombstoned, new numbers do not reuse them, and queue acknowledgements are revision-safe', async () => {
    const { repo } = await fixture();
    const workout = await start(repo);
    const exercise = workout.exercises[0];
    const id = exercise.sets[0].id;
    const old = (await repo.pending.list()).find(change => change.record_id === id);
    await repo.workouts.saveSet(id, values);
    expect(await repo.pending.snapshot(old)).toBeNull();
    expect(await repo.pending.acknowledge(old)).toBe(false);
    const current = (await repo.pending.list()).find(change => change.record_id === id);
    expect((await repo.pending.snapshot(current)).row.reps).toBe(10);
    expect(await repo.pending.acknowledge(current)).toBe(true);
    await repo.workouts.removeSet(id);
    const removed = (await repo.pending.list()).find(change => change.record_id === id);
    expect((await repo.pending.snapshot(removed)).row.deleted_at).not.toBeNull();
    await repo.workouts.addSet(exercise.id);
    const detail = await repo.history.session(workout.id);
    expect(detail.exercises[0].sets).toHaveLength(1);
    expect(detail.exercises[0].sets[0].set_number).toBe(2);
  });

  test('accounts cannot read each other and mismatched writes are rejected', async () => {
    const first = await fixture();
    const workout = await start(first.repo);
    const second = await fixture(':memory:', '44444444-4444-4444-8444-444444444444');
    expect(await second.repo.history.session(workout.id)).toBeNull();
    expect(await second.repo.pending.list()).toHaveLength(0);
    await expect(first.local.write(db => db.runAsync(`INSERT INTO workout_plans(id, user_id)
      VALUES (?, ?)`, randomUUID(), second.repo.userId))).rejects.toThrow('Account mismatch');
    const wrong = new LocalDatabase(adapter(first.connection), second.repo.userId);
    await expect(wrong.initialize()).rejects.toThrow('Account mismatch');
  });

  test('transaction failures roll back records and their pending markers', async () => {
    const { local, repo } = await fixture();
    await expect(local.write(async db => {
      await db.runAsync("INSERT INTO workout_plans(id, user_id) VALUES ('failed', ?)", userId);
      await db.runAsync("INSERT INTO pending_changes(table_name, record_id) VALUES ('workout_plans', 'failed')");
      throw new Error('simulated disk/workflow failure');
    })).rejects.toThrow('simulated');
    expect(await repo.plans.get()).toBeNull();
    expect(await repo.pending.list()).toHaveLength(0);
  });

  test('rest days reject new sessions and invalid input leaves existing set intact', async () => {
    const { repo, setDate } = await fixture();
    await repo.plans.save(plan);
    setDate(new Date(2026, 8, 22, 10));
    await expect(repo.workouts.startOrResume()).rejects.toThrow('rest day');
    setDate(new Date(2026, 8, 21, 10));
    const workout = await repo.history.session(await repo.workouts.startOrResume());
    const id = workout.exercises[0].sets[0].id;
    await repo.workouts.saveSet(id, values);
    expect(() => repo.workouts.saveSet(id, { ...values, reps: 1.5 })).toThrow();
    expect((await repo.history.session(workout.id)).exercises[0].sets[0].reps).toBe(10);
  });
});

 test('adding/reordering exercises preserves sets and database integrity', async () => {
  const { repo, local } = await fixture();
  await repo.plans.save([{ dayOfWeek: 1, bodyParts: ['Chest'], exerciseIds: [benchId] }]);
  const id = await repo.workouts.startOrResume();
  const before = await repo.history.session(id);
  await repo.workouts.saveSet(before.exercises[0].sets[0].id, values);
  const added = await repo.workouts.addExercise(id, plankId);
  await repo.workouts.reorderExercises(id, [added, before.exercises[0].id]);
  const after = await repo.history.session(id);
  expect(after.exercises[0].exercise_name).toBe('Plank');
  expect(after.exercises[1].sets[0].reps).toBe(10);
  expect(await local.read(db => db.getAllAsync('PRAGMA foreign_key_check'))).toEqual([]);
  expect(await local.read(db => db.getFirstAsync('PRAGMA integrity_check'))).toEqual({ integrity_check: 'ok' });
});
