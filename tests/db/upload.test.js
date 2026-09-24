import { expect, test } from 'bun:test';
import { cloudRow, uploadPending } from '../../src/db/sync/upload';

function fixture(failOnce = false) {
  let queue = [
    { sequence: 1, revision: 1, table_name: 'workout_sessions', record_id: 'session' },
    { sequence: 2, revision: 1, table_name: 'session_exercises', record_id: 'exercise' },
    { sequence: 3, revision: 1, table_name: 'exercise_sets', record_id: 'set' },
  ];
  const rows = {
    session: { id: 'session', user_id: 'user', status: 'completed', completed_at: '2026-09-24T10:00:00Z', body_parts: '["Chest"]' },
    exercise: { id: 'exercise', user_id: 'user', session_id: 'session' },
    set: { id: 'set', user_id: 'user', session_exercise_id: 'exercise', completed: 1 },
  };
  const remote = {};
  const writes = [];
  const repo = { userId: 'user', pending: {
    list: async () => [...queue],
    snapshot: async (change) => queue.some((q) => q.sequence === change.sequence && q.revision === change.revision) ? { change, row: rows[change.record_id] } : null,
    acknowledge: async (change) => { queue = queue.filter((q) => q.sequence !== change.sequence || q.revision !== change.revision); },
  } };
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user' } } } }) },
    from: (table) => ({
      select: () => ({ eq: (_, id) => ({ maybeSingle: async () => ({ data: remote[id] ?? null }) }) }),
      upsert: async (row, options) => {
        if (options.ignoreDuplicates && remote[row.id]) return {};
        if (failOnce && table === 'exercise_sets') { failOnce = false; return { error: { message: 'offline' } }; }
        if (remote.session?.status === 'completed') throw new Error('Completed workouts are read-only');
        writes.push([table, row.status]);
        remote[row.id] = { ...row };
        return {};
      },
    }),
  };
  return { repo, client, writes, remote };
}

test('converts SQLite booleans and historical body parts', () => {
  expect(cloudRow({ completed: 0, is_active: 1, body_parts: '["Chest"]' }))
    .toEqual({ completed: false, is_active: true, body_parts: ['Chest'] });
});

test('uploads children before sealing completed sessions', async () => {
  const { repo, client, writes } = fixture();
  await uploadPending(repo, client);
  expect(writes).toEqual([['workout_sessions', 'active'], ['session_exercises', undefined], ['exercise_sets', undefined], ['workout_sessions', 'completed']]);
  expect(await repo.pending.list()).toEqual([]);
});

test('failed child uploads retain session completion and retry safely', async () => {
  const { repo, client, remote } = fixture(true);
  await expect(uploadPending(repo, client)).rejects.toThrow('offline');
  expect(remote.session.status).toBe('active');
  expect((await repo.pending.list()).length).toBe(2);
  await uploadPending(repo, client);
  expect(remote.session.status).toBe('completed');
  expect(await repo.pending.list()).toEqual([]);
});

test('rejects an account mismatch without acknowledging changes', async () => {
  const { repo, client, writes } = fixture();
  client.auth.getSession = async () => ({ data: { session: { user: { id: 'other' } } } });
  await expect(uploadPending(repo, client)).rejects.toThrow('account changed');
  expect(writes).toEqual([]);
  expect((await repo.pending.list()).length).toBe(3);
});
