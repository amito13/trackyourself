import type { LocalDatabase, SqlConnection } from '../sqlite/connection';
import { readDay } from './plans';
import { insertRecord, localDate, markPending, tombstone } from './shared';
import type { Exercise, ExerciseSet, RepositoryRuntime, SessionExercise, SetInput, WorkoutSession } from './types';

async function requireActive(db: SqlConnection, sessionId: string, userId: string) {
  const session = await db.getFirstAsync<WorkoutSession>('SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?', sessionId, userId);
  if (!session || session.status !== 'active') throw new Error('An active workout is required');
  return session;
}

async function requireExercise(db: SqlConnection, id: string, userId: string) {
  const exercise = await db.getFirstAsync<SessionExercise>('SELECT * FROM session_exercises WHERE id = ? AND user_id = ? AND deleted_at IS NULL', id, userId);
  if (!exercise) throw new Error('Exercise not found');
  await requireActive(db, exercise.session_id, userId);
  return exercise;
}

export class WorkoutRepository {
  constructor(private local: LocalDatabase, private runtime: RepositoryRuntime) {}

  active() {
    return this.local.read(db => db.getFirstAsync<WorkoutSession>(`SELECT * FROM workout_sessions
      WHERE user_id = ? AND status = 'active' ORDER BY started_at, id LIMIT 1`, this.local.userId));
  }

  today() {
    return this.local.read(async db => {
      const weekday = this.runtime.now().getDay() || 7;
      const day = await db.getFirstAsync<{ id: string }>(`SELECT d.id FROM workout_days d
        JOIN workout_plans p ON p.id = d.plan_id WHERE p.user_id = ? AND p.is_active = 1
        AND p.deleted_at IS NULL AND d.deleted_at IS NULL AND d.day_of_week = ?`, this.local.userId, weekday);
      return day ? readDay(db, day.id) : null;
    });
  }

  startOrResume() {
    return this.local.write(async db => {
      const userId = this.local.userId;
      const active = await db.getFirstAsync<WorkoutSession>(`SELECT * FROM workout_sessions
        WHERE user_id = ? AND status = 'active' ORDER BY started_at, id LIMIT 1`, userId);
      if (active) return active.id; // Includes rest days and workouts started before midnight.
      const date = this.runtime.now();
      const now = date.toISOString();
      const day = await db.getFirstAsync<{ id: string }>(`SELECT d.id FROM workout_days d
        JOIN workout_plans p ON p.id = d.plan_id WHERE p.user_id = ? AND p.is_active = 1
        AND p.deleted_at IS NULL AND d.deleted_at IS NULL AND d.day_of_week = ?`, userId, date.getDay() || 7);
      if (!day) throw new Error('Today is a rest day');
      if (await db.getFirstAsync('SELECT id FROM workout_sessions WHERE user_id = ? AND workout_date = ?', userId, localDate(date))) {
        throw new Error('Today’s workout is already finished');
      }
      const plan = await readDay(db, day.id);
      if (!plan?.exercises.length) throw new Error('Today’s plan has no available exercises');
      const sessionId = this.runtime.uuid();
      await insertRecord(db, 'workout_sessions', { id: sessionId, user_id: userId, workout_day_id: day.id,
        workout_date: localDate(date), title: plan.bodyParts.join(' + '), body_parts: JSON.stringify(plan.bodyParts),
        started_at: now, status: 'active', created_at: now, updated_at: now });
      for (const [order, exercise] of plan.exercises.entries()) {
        await this.insertExercise(db, sessionId, exercise, order, now);
      }
      return sessionId;
    });
  }

  private async insertExercise(db: SqlConnection, sessionId: string, exercise: Exercise, order: number, now: string) {
    const id = this.runtime.uuid();
    await insertRecord(db, 'session_exercises', { id, user_id: this.local.userId, session_id: sessionId,
      exercise_id: exercise.id, exercise_name: exercise.name, muscle_group: exercise.muscle_group,
      tracking_type: exercise.tracking_type, sort_order: order, status: 'pending', created_at: now, updated_at: now });
    // Previous set count is a layout aid only; all today's values remain null.
    const session = await db.getFirstAsync<WorkoutSession>('SELECT * FROM workout_sessions WHERE id = ?', sessionId);
    const previous = await findPrevious(db, this.local.userId, exercise.id, session!.started_at);
    const count = previous ? (await db.getFirstAsync<{ total: number }>(`SELECT count(*) total FROM exercise_sets
      WHERE session_exercise_id = ? AND deleted_at IS NULL`, previous.id))!.total : 1;
    for (let i = 1; i <= Math.max(1, count); i++) {
      await insertRecord(db, 'exercise_sets', { id: this.runtime.uuid(), user_id: this.local.userId,
        session_exercise_id: id, set_number: i, tracking_type: exercise.tracking_type,
        weight_type: exercise.default_weight_type, completed: 0, created_at: now, updated_at: now });
    }
    return id;
  }

  addExercise(sessionId: string, exerciseId: string) {
    return this.local.write(async db => {
      await requireActive(db, sessionId, this.local.userId);
      const exercise = await db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ? AND deleted_at IS NULL', exerciseId);
      if (!exercise) throw new Error('Exercise is not cached');
      const order = await db.getFirstAsync<{ next: number }>('SELECT coalesce(max(sort_order), -1) + 1 AS next FROM session_exercises WHERE session_id = ?', sessionId);
      return this.insertExercise(db, sessionId, exercise, order!.next, this.runtime.now().toISOString());
    });
  }

  addSet(exerciseId: string) {
    return this.local.write(async db => {
      const exercise = await requireExercise(db, exerciseId, this.local.userId);
      const previous = await db.getFirstAsync<ExerciseSet>('SELECT * FROM exercise_sets WHERE session_exercise_id = ? AND deleted_at IS NULL ORDER BY set_number DESC LIMIT 1', exerciseId);
      const library = await db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ?', exercise.exercise_id);
      const next = await db.getFirstAsync<{ value: number }>('SELECT coalesce(max(set_number), 0) + 1 value FROM exercise_sets WHERE session_exercise_id = ?', exerciseId);
      const now = this.runtime.now().toISOString();
      const id = this.runtime.uuid();
      await insertRecord(db, 'exercise_sets', { id, user_id: this.local.userId, session_exercise_id: exerciseId,
        set_number: next!.value, tracking_type: exercise.tracking_type,
        weight_type: previous?.weight_type ?? library!.default_weight_type, completed: 0, created_at: now, updated_at: now });
      await this.setStatus(db, exerciseId, 'pending', now);
      return id;
    });
  }

  saveSet(id: string, input: SetInput) {
    for (const value of [input.weightKg, input.reps, input.durationSeconds]) {
      if (value !== null && !Number.isFinite(value)) throw new Error('Enter valid numbers or leave fields blank');
    }
    if ((input.reps !== null && (!Number.isInteger(input.reps) || input.reps <= 0))
      || (input.durationSeconds !== null && (!Number.isInteger(input.durationSeconds) || input.durationSeconds <= 0))
      || (input.weightKg !== null && (input.weightKg < 0 || input.weightKg > 9999999.999))) {
      throw new Error('Enter a valid weight and positive whole reps or seconds');
    }
    return this.local.write(async db => {
      const set = await db.getFirstAsync<ExerciseSet>('SELECT * FROM exercise_sets WHERE id = ? AND deleted_at IS NULL', id);
      if (!set) throw new Error('Set not found');
      const exercise = await requireExercise(db, set.session_exercise_id, this.local.userId);
      const weight = input.weightType === 'bodyweight' ? null : input.weightKg;
      const reps = exercise.tracking_type === 'reps' ? input.reps : null;
      const duration = exercise.tracking_type === 'duration' ? input.durationSeconds : null;
      const complete = (input.weightType === 'bodyweight' || weight !== null) && (reps !== null || duration !== null);
      const now = this.runtime.now().toISOString();
      await db.runAsync(`UPDATE exercise_sets SET weight_type = ?, weight_kg = ?, reps = ?,
        duration_seconds = ?, completed = ?, updated_at = ? WHERE id = ?`,
      input.weightType, weight === null ? null : Math.round(weight * 1000) / 1000, reps, duration, Number(complete), now, id);
      await markPending(db, 'exercise_sets', id);
      await this.setStatus(db, exercise.id, 'pending', now);
    });
  }

  removeSet(id: string) {
    return this.local.write(async db => {
      const set = await db.getFirstAsync<ExerciseSet>('SELECT * FROM exercise_sets WHERE id = ? AND deleted_at IS NULL', id);
      if (!set) throw new Error('Set not found');
      await requireExercise(db, set.session_exercise_id, this.local.userId);
      const now = this.runtime.now().toISOString();
      await tombstone(db, 'exercise_sets', id, now);
      // Keep stable set numbers: gaps avoid transient cloud uniqueness conflicts on sync.
      await this.setStatus(db, set.session_exercise_id, 'pending', now);
    });
  }

  private async setStatus(db: SqlConnection, id: string, status: SessionExercise['status'], now: string) {
    await db.runAsync('UPDATE session_exercises SET status = ?, updated_at = ? WHERE id = ?', status, now, id);
    await markPending(db, 'session_exercises', id);
  }

  completeExercise(id: string) {
    return this.local.write(async db => {
      await requireExercise(db, id, this.local.userId);
      const valid = await db.getFirstAsync('SELECT id FROM exercise_sets WHERE session_exercise_id = ? AND completed = 1 AND deleted_at IS NULL', id);
      await this.setStatus(db, id, valid ? 'completed' : 'pending', this.runtime.now().toISOString());
    });
  }

  skipExercise(id: string) {
    return this.local.write(async db => {
      await requireExercise(db, id, this.local.userId);
      await this.setStatus(db, id, 'skipped', this.runtime.now().toISOString());
    });
  }

  reorderExercises(sessionId: string, ids: string[]) {
    return this.local.write(async db => {
      await requireActive(db, sessionId, this.local.userId);
      const rows = await db.getAllAsync<{ id: string }>('SELECT id FROM session_exercises WHERE session_id = ? AND deleted_at IS NULL', sessionId);
      if (ids.length !== rows.length || new Set(ids).size !== ids.length || rows.some(row => !ids.includes(row.id))) {
        throw new Error('Order must include every exercise exactly once');
      }
      for (const [order, id] of ids.entries()) {
        await db.runAsync('UPDATE session_exercises SET sort_order = ?, updated_at = ? WHERE id = ?', order, this.runtime.now().toISOString(), id);
        await markPending(db, 'session_exercises', id);
      }
    });
  }

  finish(id: string) {
    return this.local.write(async db => {
      const session = await requireActive(db, id, this.local.userId);
      const now = this.runtime.now().toISOString();
      if (now < session.started_at) throw new Error('Device time is earlier than workout start');
      const exercises = await db.getAllAsync<SessionExercise>('SELECT * FROM session_exercises WHERE session_id = ? AND deleted_at IS NULL', id);
      for (const exercise of exercises) {
        if (exercise.status === 'skipped') continue;
        const valid = await db.getFirstAsync('SELECT id FROM exercise_sets WHERE session_exercise_id = ? AND completed = 1 AND deleted_at IS NULL', exercise.id);
        await this.setStatus(db, exercise.id, valid ? 'completed' : 'pending', now);
      }
      await db.runAsync("UPDATE workout_sessions SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?", now, now, id);
      await markPending(db, 'workout_sessions', id);
    });
  }
}

export function findPrevious(db: SqlConnection, userId: string, exerciseId: string, before: string) {
  return db.getFirstAsync<SessionExercise & { started_at: string; workout_date: string }>(`SELECT e.*, s.started_at, s.workout_date
    FROM session_exercises e JOIN workout_sessions s ON s.id = e.session_id
    WHERE s.user_id = ? AND s.status = 'completed' AND julianday(s.started_at) < julianday(?)
      AND e.exercise_id = ? AND e.status = 'completed' AND e.deleted_at IS NULL
      AND EXISTS (SELECT 1 FROM exercise_sets sets WHERE sets.session_exercise_id = e.id
        AND sets.completed = 1 AND sets.deleted_at IS NULL)
    ORDER BY julianday(s.started_at) DESC, s.id DESC LIMIT 1`, userId, before, exerciseId);
}
