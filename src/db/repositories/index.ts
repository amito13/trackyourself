import { AnalyticsRepository } from './analytics';
import type { LocalDatabase } from '../sqlite/connection';
import { ExerciseRepository } from './exercises';
import { HistoryRepository } from './history';
import { PendingRepository } from './pending';
import { PlanRepository } from './plans';
import { ProfileRepository } from './profile';
import type { RepositoryRuntime } from './types';
import { WorkoutRepository } from './workouts';

export function createRepositories(database: LocalDatabase, runtime: RepositoryRuntime) {
  return {
    userId: database.userId,
    subscribe: database.subscribe,
    clearAccount: () => database.write(async (db) => {
      // This file belongs to one account. Remove children before their parents.
      for (const table of ['pending_changes', 'exercise_sets', 'session_exercises',
        'workout_sessions', 'workout_day_exercises', 'workout_day_body_parts',
        'workout_days', 'workout_plans', 'exercises', 'users']) {
        await db.execAsync(`DELETE FROM ${table}`);
      }
    }, false),
    profile: new ProfileRepository(database, runtime),
    exercises: new ExerciseRepository(database),
    plans: new PlanRepository(database, runtime),
    workouts: new WorkoutRepository(database, runtime),
    history: new HistoryRepository(database),
    analytics: new AnalyticsRepository(database),
    pending: new PendingRepository(database),
  };
}
export type Repositories = ReturnType<typeof createRepositories>;
export type * from './types';
