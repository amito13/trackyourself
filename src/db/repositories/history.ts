import type { LocalDatabase } from '../sqlite/connection';
import type { ExerciseSet, SessionExercise, WorkoutSession } from './types';
import { findPrevious } from './workouts';

export class HistoryRepository {
  constructor(private local: LocalDatabase) {}

  list(limit = 30, offset = 0) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
      throw new Error('Invalid history page');
    }
    return this.local.read(db => db.getAllAsync<WorkoutSession>(`SELECT * FROM workout_sessions
      WHERE user_id = ? AND status = 'completed' ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?`,
    this.local.userId, limit, offset));
  }

  session(id: string) {
    return this.local.read(async db => {
      const session = await db.getFirstAsync<WorkoutSession>('SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?', id, this.local.userId);
      if (!session) return null;
      const exercises = await db.getAllAsync<SessionExercise>('SELECT * FROM session_exercises WHERE session_id = ? AND deleted_at IS NULL ORDER BY sort_order, id', id);
      const sets = await db.getAllAsync<ExerciseSet>(`SELECT sets.* FROM exercise_sets sets
        JOIN session_exercises e ON e.id = sets.session_exercise_id
        WHERE e.session_id = ? AND e.deleted_at IS NULL AND sets.deleted_at IS NULL
        ORDER BY e.sort_order, sets.set_number`, id);
      return {
        ...session,
        bodyParts: JSON.parse(session.body_parts) as string[],
        exercises: exercises.map(exercise => ({ ...exercise, sets: sets.filter(set => set.session_exercise_id === exercise.id) })),
        completedSets: sets.filter(set => set.completed === 1 && exercises.some(e => e.id === set.session_exercise_id && e.status === 'completed')).length,
        durationSeconds: session.completed_at ? Math.floor((Date.parse(session.completed_at) - Date.parse(session.started_at)) / 1000) : null,
      };
    });
  }

  compare(sessionExerciseId: string) {
    return this.local.read(async db => {
      const exercise = await db.getFirstAsync<SessionExercise & { started_at: string; workout_date: string }>(`SELECT e.*, s.started_at, s.workout_date
        FROM session_exercises e JOIN workout_sessions s ON s.id = e.session_id
        WHERE e.id = ? AND s.user_id = ? AND e.deleted_at IS NULL`, sessionExerciseId, this.local.userId);
      if (!exercise) return null;
      const sets = await db.getAllAsync<ExerciseSet>('SELECT * FROM exercise_sets WHERE session_exercise_id = ? AND deleted_at IS NULL ORDER BY set_number', exercise.id);
      const previous = await findPrevious(db, this.local.userId, exercise.exercise_id, exercise.started_at);
      const previousSets = previous ? await db.getAllAsync<ExerciseSet>('SELECT * FROM exercise_sets WHERE session_exercise_id = ? AND deleted_at IS NULL ORDER BY set_number', previous.id) : [];
      return { current: { ...exercise, sets }, previous: previous ? { ...previous, sets: previousSets } : null };
    });
  }
}
