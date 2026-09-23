import type { LocalDatabase } from '../sqlite/connection';
import type { MutableTable, PendingChange } from './types';

const TABLES: readonly MutableTable[] = [
  'users',
  'workout_plans',
  'workout_days',
  'workout_day_body_parts',
  'workout_day_exercises',
  'workout_sessions',
  'session_exercises',
  'exercise_sets',
];

/** Queue storage only. A future sync engine handles dependencies and completion ordering. */
export class PendingRepository {
  constructor(private local: LocalDatabase) {}

  list() {
    return this.local.read((db) =>
      db.getAllAsync<PendingChange>('SELECT * FROM pending_changes ORDER BY sequence'),
    );
  }

  snapshot(change: PendingChange) {
    if (!TABLES.includes(change.table_name)) throw new Error('Invalid sync table');
    return this.local.read(async (db) => {
      const current = await db.getFirstAsync<PendingChange>(
        'SELECT * FROM pending_changes WHERE sequence = ? AND revision = ?',
        change.sequence,
        change.revision,
      );
      if (
        !current ||
        current.table_name !== change.table_name ||
        current.record_id !== change.record_id
      )
        return null;
      const row = await db.getFirstAsync<Record<string, string | number | null>>(
        `SELECT * FROM ${current.table_name} WHERE id = ?`,
        current.record_id,
      );
      return row ? { change: current, row } : null;
    });
  }

  /** Only acknowledge the exact uploaded revision; never clear newer local edits. */
  acknowledge(change: PendingChange) {
    return this.local.write(async (db) => {
      const result = await db.runAsync(
        `DELETE FROM pending_changes WHERE sequence = ? AND revision = ?
        AND table_name = ? AND record_id = ?`,
        change.sequence,
        change.revision,
        change.table_name,
        change.record_id,
      );
      return result.changes === 1;
    });
  }
}
