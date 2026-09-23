import type { LocalDatabase, SqlConnection } from '../sqlite/connection';
import { insertRecord, markPending, tombstone } from './shared';
import type { DayPlan, Exercise, PlanInput, RepositoryRuntime, WorkoutDay } from './types';

export async function readDay(db: SqlConnection, id: string): Promise<DayPlan | null> {
  const day = await db.getFirstAsync<WorkoutDay>('SELECT * FROM workout_days WHERE id = ? AND deleted_at IS NULL', id);
  if (!day) return null;
  const parts = await db.getAllAsync<{ body_part: string }>(`SELECT body_part FROM workout_day_body_parts
    WHERE workout_day_id = ? AND deleted_at IS NULL ORDER BY created_at, id`, id);
  const exercises = await db.getAllAsync<Exercise>(`SELECT e.* FROM workout_day_exercises w
    JOIN exercises e ON e.id = w.exercise_id WHERE w.workout_day_id = ?
    AND w.deleted_at IS NULL AND e.deleted_at IS NULL ORDER BY w.sort_order, w.id`, id);
  return { ...day, bodyParts: parts.map(part => part.body_part), exercises };
}

export class PlanRepository {
  constructor(private local: LocalDatabase, private runtime: RepositoryRuntime) {}

  get() {
    return this.local.read(async db => {
      const plan = await db.getFirstAsync<{ id: string; name: string }>(`SELECT id, name FROM workout_plans
        WHERE user_id = ? AND is_active = 1 AND deleted_at IS NULL`, this.local.userId);
      if (!plan) return null;
      const days = await db.getAllAsync<{ id: string }>(`SELECT id FROM workout_days WHERE plan_id = ?
        AND deleted_at IS NULL ORDER BY day_of_week`, plan.id);
      const result: DayPlan[] = [];
      for (const day of days) {
        const detail = await readDay(db, day.id);
        if (detail) result.push(detail);
      }
      return { ...plan, days: result };
    });
  }

  /** Replace configuration atomically; preserve old rows and session snapshots. */
  save(days: PlanInput[]) {
    if (!days.length || new Set(days.map(day => day.dayOfWeek)).size !== days.length) {
      throw new Error('Select at least one unique workout day');
    }
    for (const day of days) {
      if (!Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 1 || day.dayOfWeek > 7
        || !day.bodyParts.length || day.bodyParts.some(part => !part.trim())
        || new Set(day.bodyParts).size !== day.bodyParts.length
        || !day.exerciseIds.length || new Set(day.exerciseIds).size !== day.exerciseIds.length) {
        throw new Error('Each day needs valid body parts and unique exercises');
      }
    }
    return this.local.write(async db => {
      const now = this.runtime.now().toISOString();
      const userId = this.local.userId;
      if (!await db.getFirstAsync('SELECT id FROM users WHERE id = ?', userId)) {
        throw new Error('Local profile is not initialized');
      }
      // Validate the entire draft before removing any previous configuration.
      for (const day of days) {
        const groups = new Set<string>();
        for (const id of day.exerciseIds) {
          const exercise = await db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ? AND deleted_at IS NULL', id);
          if (!exercise || !day.bodyParts.includes(exercise.muscle_group)) {
            throw new Error('Choose cached exercises belonging to the selected body parts');
          }
          groups.add(exercise.muscle_group);
        }
        if (day.bodyParts.some(part => !groups.has(part))) throw new Error('Choose an exercise for every body part');
      }
      const existing = await db.getFirstAsync<{ id: string }>(`SELECT id FROM workout_plans
        WHERE user_id = ? AND is_active = 1 AND deleted_at IS NULL`, userId);
      const planId = existing?.id ?? this.runtime.uuid();
      if (!existing) {
        await insertRecord(db, 'workout_plans', { id: planId, user_id: userId,
          name: 'My Workout Plan', is_active: 1, created_at: now, updated_at: now });
      }
      const oldDays = await db.getAllAsync<{ id: string }>('SELECT id FROM workout_days WHERE plan_id = ? AND deleted_at IS NULL', planId);
      for (const day of oldDays) {
        for (const table of ['workout_day_exercises', 'workout_day_body_parts'] as const) {
          const mappings = await db.getAllAsync<{ id: string }>(`SELECT id FROM ${table} WHERE workout_day_id = ? AND deleted_at IS NULL`, day.id);
          for (const mapping of mappings) await tombstone(db, table, mapping.id, now);
        }
        await tombstone(db, 'workout_days', day.id, now);
      }
      for (const day of days) {
        const dayId = this.runtime.uuid();
        await insertRecord(db, 'workout_days', { id: dayId, user_id: userId, plan_id: planId,
          day_of_week: day.dayOfWeek, sort_order: day.dayOfWeek - 1, created_at: now, updated_at: now });
        for (const bodyPart of day.bodyParts) {
          await insertRecord(db, 'workout_day_body_parts', { id: this.runtime.uuid(), user_id: userId,
            workout_day_id: dayId, body_part: bodyPart, created_at: now, updated_at: now });
        }
        for (const [order, id] of day.exerciseIds.entries()) {
          await insertRecord(db, 'workout_day_exercises', { id: this.runtime.uuid(), user_id: userId,
            workout_day_id: dayId, exercise_id: id, sort_order: order, created_at: now, updated_at: now });
        }
      }
      await db.runAsync('UPDATE users SET onboarding_done = 1, updated_at = ? WHERE id = ?', now, userId);
      await markPending(db, 'users', userId);
      return planId;
    });
  }
}
