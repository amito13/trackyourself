import type { SupabaseClient } from '@supabase/supabase-js';
import type { Repositories, MutableTable } from '../repositories';

const order: MutableTable[] = ['users', 'workout_plans', 'workout_days',
  'workout_day_body_parts', 'workout_day_exercises', 'workout_sessions',
  'session_exercises', 'exercise_sets'];

export function cloudRow(row: Record<string, string | number | null>) {
  const result: Record<string, unknown> = { ...row };
  for (const key of ['onboarding_done', 'is_active', 'completed']) {
    if (key in result) result[key] = Boolean(result[key]);
  }
  if (typeof result.body_parts === 'string') result.body_parts = JSON.parse(result.body_parts);
  return result;
}

/** One caller per account. Failed writes stay queued; acknowledgements are revision-bound. */
export async function uploadPending(
  repositories: Repositories,
  client: SupabaseClient,
  isCurrent: () => boolean = () => true,
) {
  async function ensureSession() {
    if (!isCurrent()) throw new Error('Sync stopped');
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (data.session?.user.id !== repositories.userId) throw new Error('Sync account changed');
  }
  async function insertMissing(table: MutableTable, row: Record<string, unknown>) {
    await ensureSession();
    const { error } = await client.from(table).upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  async function save(table: MutableTable, row: Record<string, unknown>) {
    if (!isCurrent()) throw new Error('Sync stopped');
    const { data: auth, error: authError } = await client.auth.getSession();
    if (authError) throw authError;
    if (auth.session?.user.id !== repositories.userId) throw new Error('Sync account changed');
    const { data, error: readError } = await client.from(table).select('*').eq('id', row.id).maybeSingle();
    if (readError) throw readError;
    if (table === 'users') {
      if (!data) throw new Error('Cloud profile is missing. Apply the database migration and auth profile backfill.');
      const { error } = await client.from('users').update({
        name: row.name, avatar_url: row.avatar_url, onboarding_done: row.onboarding_done,
      }).eq('id', repositories.userId).select('id').single();
      if (error) throw new Error(`users: ${error.message}`);
      return;
    }
    // Recover safely when the server committed a request whose response was lost.
    if (data && Object.keys(row).every((key) =>
      key === 'updated_at' || key === 'created_at' ||
      (key.endsWith('_at') && data[key] && row[key]
        ? Date.parse(data[key]) === Date.parse(String(row[key]))
        : JSON.stringify(data[key]) === JSON.stringify(row[key])))) return;
    if (!isCurrent()) throw new Error('Sync stopped');
    const request = data
      ? client.from(table).update(row).eq('id', row.id)
      : client.from(table).insert(row);
    const { error } = await request.select('id').single();
    if (error) throw new Error(`${table}: ${error.message}`);
  }

  const snapshots = (await Promise.all((await repositories.pending.list())
    .map((change) => repositories.pending.snapshot(change))))
    .filter((snapshot) => snapshot !== null);
  snapshots.sort((a, b) => order.indexOf(a.change.table_name) - order.indexOf(b.change.table_name)
    || Number(Boolean(b.row.deleted_at) || b.row.is_active === 0)
      - Number(Boolean(a.row.deleted_at) || a.row.is_active === 0)
    || a.change.sequence - b.change.sequence);
  const completed = [];
  const deletedExercises = [];
  for (const snapshot of snapshots) {
    const { change, row } = snapshot;
    if (!isCurrent()) return;
    if (change.table_name === 'workout_sessions' && row.status === 'completed') {
      // Insert-only avoids reopening an already completed session on retry.
      await insertMissing('workout_sessions', { ...cloudRow(row), status: 'active', completed_at: null });
      completed.push(snapshot);
      continue;
    }
    if (change.table_name === 'session_exercises' && row.deleted_at) {
      // Sets must upload while their parent exercise is still live.
      await insertMissing(change.table_name, { ...cloudRow(row), deleted_at: null });
      deletedExercises.push(snapshot);
      continue;
    }
    await save(change.table_name, cloudRow(row));
    await repositories.pending.acknowledge(change);
  }
  for (const { change, row } of deletedExercises) {
    await save(change.table_name, cloudRow(row));
    await repositories.pending.acknowledge(change);
  }
  // New edits may have arrived during network requests. Never seal a session
  // until all queued child revisions have been uploaded.
  const remaining = await repositories.pending.list();
  if (remaining.some((change) => change.table_name === 'session_exercises' || change.table_name === 'exercise_sets')) return;
  for (const { change, row } of completed) {
    if (!await repositories.pending.snapshot(change)) continue;
    await save(change.table_name, cloudRow(row));
    await repositories.pending.acknowledge(change);
  }
}
