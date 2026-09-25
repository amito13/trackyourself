import type { LocalDatabase } from '../sqlite/connection';

export interface AnalyticsRow {
  session_id: string;
  workout_date: string;
  exercise_id: string | null;
  exercise_name: string | null;
  volume: number;
  heaviest: number | null;
  completed_sets: number;
}

// Aggregate in SQLite so the screen never loads individual sets or paginated history.
export const ANALYTICS_SQL = `
  SELECT s.id AS session_id, s.workout_date, e.exercise_id, e.exercise_name,
    COALESCE(SUM(CASE WHEN t.weight_type = 'weighted' AND t.tracking_type = 'reps'
      THEN t.weight_kg * t.reps ELSE 0 END), 0) AS volume,
    MAX(CASE WHEN t.weight_type = 'weighted' THEN t.weight_kg END) AS heaviest,
    COUNT(t.id) AS completed_sets
  FROM workout_sessions s
  LEFT JOIN session_exercises e ON e.session_id = s.id AND e.user_id = s.user_id
    AND e.status = 'completed' AND e.deleted_at IS NULL
  LEFT JOIN exercise_sets t ON t.session_exercise_id = e.id AND t.user_id = s.user_id
    AND t.completed = 1 AND t.deleted_at IS NULL
  WHERE s.user_id = ? AND s.status = 'completed'
    AND s.workout_date >= ? AND s.workout_date <= ?
  GROUP BY s.id, e.exercise_id
  ORDER BY s.workout_date, s.started_at, e.sort_order`;

export class AnalyticsRepository {
  constructor(private local: LocalDatabase) {}

  range(start: string, end: string) {
    return this.local.read((db) =>
      db.getAllAsync<AnalyticsRow>(ANALYTICS_SQL, this.local.userId, start, end),
    );
  }
}
