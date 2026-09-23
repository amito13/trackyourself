export type TrackingType = 'reps' | 'duration';
export type WeightType = 'weighted' | 'bodyweight';
export type ExerciseStatus = 'pending' | 'completed' | 'skipped';
export interface Profile {
  id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  onboarding_done: number;
}
export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  image_url: string | null;
  tracking_type: TrackingType;
  default_weight_type: WeightType;
  deleted_at: string | null;
}
export interface WorkoutDay {
  id: string;
  plan_id: string;
  day_of_week: number;
  sort_order: number;
}
export interface DayPlan extends WorkoutDay {
  bodyParts: string[];
  exercises: Exercise[];
}
export interface PlanInput {
  dayOfWeek: number;
  bodyParts: string[];
  exerciseIds: string[];
}
export interface WorkoutSession {
  id: string;
  user_id: string;
  workout_day_id: string | null;
  workout_date: string;
  title: string;
  body_parts: string; // JSON string in SQLite; decode before uploading to PostgreSQL.
  started_at: string;
  completed_at: string | null;
  status: 'active' | 'completed';
}
export interface SessionExercise {
  id: string;
  session_id: string;
  exercise_id: string;
  exercise_name: string;
  muscle_group: string;
  tracking_type: TrackingType;
  sort_order: number;
  status: ExerciseStatus;
}
export interface ExerciseSet {
  id: string;
  session_exercise_id: string;
  set_number: number;
  tracking_type: TrackingType;
  weight_type: WeightType;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  completed: number;
}
export interface SetInput {
  weightType: WeightType;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
}
export type MutableTable =
  | 'users'
  | 'workout_plans'
  | 'workout_days'
  | 'workout_day_body_parts'
  | 'workout_day_exercises'
  | 'workout_sessions'
  | 'session_exercises'
  | 'exercise_sets';
export interface PendingChange {
  sequence: number;
  table_name: MutableTable;
  record_id: string;
  revision: number;
}
export interface RepositoryRuntime {
  uuid(): string;
  now(): Date;
}
