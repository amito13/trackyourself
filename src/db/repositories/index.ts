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
    profile: new ProfileRepository(database, runtime),
    exercises: new ExerciseRepository(database),
    plans: new PlanRepository(database, runtime),
    workouts: new WorkoutRepository(database, runtime),
    history: new HistoryRepository(database),
    pending: new PendingRepository(database),
  };
}
export type Repositories = ReturnType<typeof createRepositories>;
export type * from './types';
